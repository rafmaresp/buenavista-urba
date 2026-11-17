import { describe, expect, it } from 'vitest';
import { FarolaCambiada, RepositorioFarolas } from './farolas-repo';
import { clienteAdmin, clienteConSas, conTablasTemporales, contar, hayAzuriteConClave } from './pruebas/azurite';
import { UID_ANA } from './pruebas/usuarios-dobles';

// Mismos permisos que FAROLAS_CONNECTION (sp=ru) y AUDITORIA_CONNECTION (sp=ra) en infra/main.bicep
// (lo fija tablas.test.ts). La farola de partida la siembra el cliente de administración.
const F07 = { partitionKey: 'farola', rowKey: 'F07', calle: 'C. M', lat: 37.31, lon: -5.96, precision: 'estimada' };
const NUEVA = { lat: 37.3101, lon: -5.9602 };

function repo(farolas: string, auditoria: string, permisosAuditoria = { query: true, add: true }) {
  return new RepositorioFarolas(
    clienteConSas(farolas, { query: true, update: true }),
    clienteConSas(auditoria, permisosAuditoria),
  );
}

describe('Reubicar farola (Azurite)', () => {
  it.runIf(hayAzuriteConClave)('con el SAS de la app mueve la farola y deja la entrada farola.reubicacion', async () => {
    await conTablasTemporales(['Farolas', 'Auditoria'], async ([farolas, auditoria]) => {
      await clienteAdmin(farolas!).createEntity(F07);
      const farola = await repo(farolas!, auditoria!).reubicar('F07', NUEVA, UID_ANA);

      expect(farola).toEqual({ id: 'F07', calle: 'C. M', ...NUEVA });
      const guardada = await clienteAdmin(farolas!).getEntity('farola', 'F07');
      expect(guardada).toMatchObject({ calle: 'C. M', ...NUEVA, precision: 'verificada' });

      const entradas = [];
      for await (const e of clienteAdmin(auditoria!).listEntities<{ antes: string; despues: string }>()) entradas.push(e);
      expect(entradas).toHaveLength(1);
      expect(entradas[0]).toMatchObject({ actor: UID_ANA, accion: 'farola.reubicacion', clave: 'F07' });
      expect(JSON.parse(entradas[0]!.antes)).toEqual({ lat: 37.31, lon: -5.96, precision: 'estimada' });
      expect(JSON.parse(entradas[0]!.despues)).toEqual({ ...NUEVA, precision: 'verificada' });
    });
  });

  it.runIf(hayAzuriteConClave)('si otra escritura cambió la farola tras leerla, FarolaCambiada y no la pisa', async () => {
    await conTablasTemporales(['Farolas', 'Auditoria'], async ([farolas, auditoria]) => {
      await clienteAdmin(farolas!).createEntity(F07);
      const cliente = clienteConSas(farolas!, { query: true, update: true });
      // La lectura del repositorio ve la fila; justo después, otra reubicación la cambia.
      const lento = new RepositorioFarolas(
        {
          ...cliente,
          listEntities: cliente.listEntities.bind(cliente),
          createEntity: cliente.createEntity.bind(cliente),
          deleteEntity: cliente.deleteEntity.bind(cliente),
          updateEntity: cliente.updateEntity.bind(cliente),
          getEntity: async (pk: string, rk: string) => {
            const leida = await cliente.getEntity(pk, rk);
            await clienteAdmin(farolas!).updateEntity({ partitionKey: pk, rowKey: rk, lat: 37.32 }, 'Merge');
            return leida;
          },
        } as never,
        clienteConSas(auditoria!, { query: true, add: true }),
      );

      await expect(lento.reubicar('F07', NUEVA, UID_ANA)).rejects.toBeInstanceOf(FarolaCambiada);
      expect(await clienteAdmin(farolas!).getEntity('farola', 'F07')).toMatchObject({ lat: 37.32, precision: 'estimada' });
      expect(await contar(clienteAdmin(auditoria!))).toBe(0);
    });
  });

  it.runIf(hayAzuriteConClave)('si la auditoría falla, la farola vuelve a su posición con el SAS de la app', async () => {
    await conTablasTemporales(['Farolas', 'Auditoria'], async ([farolas, auditoria]) => {
      await clienteAdmin(farolas!).createEntity(F07);
      // SAS de Auditoria solo de lectura: añadir falla con 403 y se restaura la farola.
      await expect(repo(farolas!, auditoria!, { query: true } as never).reubicar('F07', NUEVA, UID_ANA)).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(await clienteAdmin(farolas!).getEntity('farola', 'F07')).toMatchObject({ lat: 37.31, lon: -5.96, precision: 'estimada' });
    });
  });
});
