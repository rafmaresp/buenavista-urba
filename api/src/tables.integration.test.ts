import { describe, expect, it } from 'vitest';
import { auditar, entidadDeAuditoria } from './auditoria';
import {
  clienteAdmin,
  clienteConCadenaSas,
  clienteConSas,
  conTablasTemporales,
  conexionAdmin,
  esperarProhibido,
  hayAzuriteConClave,
  sasDeTabla,
} from './pruebas/azurite';
import { listarFarolas } from './farolas';

describe('Table Storage (Azurite)', () => {
  it.runIf(process.env.REQUIRE_AZURITE)('la CI tiene conexión con Azurite', () => {
    expect(conexionAdmin, 'falta TABLES_CONNECTION').toBeTruthy();
    expect(hayAzuriteConClave, 'faltan TABLES_ACCOUNT_NAME o TABLES_ACCOUNT_KEY').toBe(true);
  });

  it.runIf(conexionAdmin)('escribe y lee una entidad en una tabla temporal', async () => {
    await conTablasTemporales(['prueba'], async ([tabla]) => {
      const client = clienteAdmin(tabla!);
      await client.upsertEntity({ partitionKey: 'p', rowKey: 'r', valor: 42 });
      expect((await client.getEntity<{ valor: number }>('p', 'r')).valor).toBe(42);
    });
  });

  // Mismos permisos que FAROLAS_CONNECTION en infra/main.bicep (SAS de servicio de la tabla, sp=r).
  it.runIf(hayAzuriteConClave)('el SAS de Farolas de la app consulta el catálogo pero no escribe', async () => {
    await conTablasTemporales(['Farolas'], async ([tabla]) => {
      await clienteAdmin(tabla!).createEntity({ partitionKey: 'farola', rowKey: 'F01', calle: 'C. M', lat: 37.31, lon: -5.96, precision: 'estimada' });
      const app = clienteConSas(tabla!, { query: true });

      expect(await listarFarolas(app)).toEqual([{ id: 'F01', calle: 'C. M', lat: 37.31, lon: -5.96 }]);
      await esperarProhibido(app.createEntity({ partitionKey: 'farola', rowKey: 'F02', calle: 'x', lat: 1, lon: 1 }));
      await esperarProhibido(app.updateEntity({ partitionKey: 'farola', rowKey: 'F01', lat: 0 }, 'Merge'));
      await esperarProhibido(app.deleteEntity('farola', 'F01'));
      await esperarProhibido(app.deleteTable());
    });
  });

  // Mismos permisos que AUDITORIA_CONNECTION en infra/main.bicep (sp=ra): append-only para la app.
  it.runIf(hayAzuriteConClave)('el SAS de Auditoria de la app añade y lee, pero no modifica ni borra', async () => {
    await conTablasTemporales(['Auditoria'], async ([tabla]) => {
      const app = clienteConSas(tabla!, { query: true, add: true });
      await auditar(
        app,
        entidadDeAuditoria({
          actor: 'sistema:prueba',
          accion: 'farola.alta',
          entidad: 'Farolas',
          clave: 'F01',
          antes: null,
          despues: { lat: 37.31 },
        }),
      );
      const entradas = [];
      for await (const e of app.listEntities<{ clave: string }>()) entradas.push(e);
      expect(entradas.map((e) => e.clave)).toEqual(['F01']);
      const { partitionKey, rowKey } = entradas[0]!;

      await esperarProhibido(app.updateEntity({ partitionKey: partitionKey!, rowKey: rowKey!, clave: 'F99' }, 'Merge'));
      await esperarProhibido(app.upsertEntity({ partitionKey: partitionKey!, rowKey: rowKey!, clave: 'F99' }, 'Replace'));
      await esperarProhibido(app.deleteEntity(partitionKey!, rowKey!));
      await esperarProhibido(app.deleteTable());
      expect((await clienteAdmin(tabla!).getEntity<{ clave: string }>(partitionKey!, rowKey!)).clave).toBe('F01');
    });
  });

  it.runIf(hayAzuriteConClave)('el SAS de una tabla no sirve para otra', async () => {
    await conTablasTemporales(['Farolas', 'Auditoria'], async ([farolas, auditoria]) => {
      const sasDeFarolas = sasDeTabla(farolas!, { query: true, add: true, update: true, delete: true });
      const otra = clienteConCadenaSas(auditoria!, sasDeFarolas);
      await esperarProhibido(otra.createEntity({ partitionKey: 'p', rowKey: 'r' }));
      await esperarProhibido(listarFarolas(otra));
    });
  });
});
