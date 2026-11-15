import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cargarFarolas } from './carga-farolas';
import { parsearSemilla } from './farolas';
import { RepositorioFarolas } from './farolas-repo';
import { clienteAdmin, clienteConSas, conTablasTemporales, contar, hayAzuriteConClave } from './pruebas/azurite';

const semilla = parsearSemilla(readFileSync(join(__dirname, '..', '..', 'data', 'farolas_buenavista.csv'), 'utf8'));

// Con los mismos permisos que el workflow "Cargar farolas": Farolas rad, Auditoria a.
function clientesDeCarga(farolas: string, auditoria: string): RepositorioFarolas {
  return new RepositorioFarolas(
    clienteConSas(farolas, { query: true, add: true, delete: true }),
    clienteConSas(auditoria, { add: true }),
  );
}

interface EntradaGuardada {
  actor: string;
  accion: string;
  entidad: string;
  clave: string;
  antes: string;
  despues: string;
}

describe.runIf(hayAzuriteConClave)('carga de farolas (Azurite)', () => {
  it('en un catálogo vacío da de alta las 70 farolas, cada una con su entrada de auditoría', async () => {
    await conTablasTemporales(['Farolas', 'Auditoria'], async ([farolas, auditoria]) => {
      const resultado = await cargarFarolas(clientesDeCarga(farolas!, auditoria!), semilla);
      expect(resultado.altas).toHaveLength(70);
      expect(resultado.existentes).toBe(0);
      expect(await contar(clienteAdmin(farolas!))).toBe(70);

      const entradas: EntradaGuardada[] = [];
      for await (const e of clienteAdmin(auditoria!).listEntities<EntradaGuardada>()) entradas.push(e);
      expect(entradas).toHaveLength(70);
      expect(new Set(entradas.map((e) => e.clave)).size).toBe(70);
      for (const e of entradas) {
        expect(e).toMatchObject({ actor: 'sistema:carga', accion: 'farola.alta', entidad: 'Farolas', antes: '' });
      }
      const f62 = entradas.find((e) => e.clave === 'F62')!;
      expect(JSON.parse(f62.despues)).toEqual({ calle: 'C. H / C. Q', lat: 37.3154785, lon: -5.9617603, precision: 'estimada' });
      expect((await clienteAdmin(farolas!).getEntity<{ precision: string }>('farola', 'F01')).precision).toBe('verificada');
    });
  });

  it('relanzarla no crea, modifica ni audita nada', async () => {
    await conTablasTemporales(['Farolas', 'Auditoria'], async ([farolas, auditoria]) => {
      await cargarFarolas(clientesDeCarga(farolas!, auditoria!), semilla);
      const antes = await clienteAdmin(farolas!).getEntity('farola', 'F10');

      const segunda = await cargarFarolas(clientesDeCarga(farolas!, auditoria!), semilla);
      expect(segunda).toEqual({ altas: [], existentes: 70 });
      expect(await contar(clienteAdmin(farolas!))).toBe(70);
      expect(await contar(clienteAdmin(auditoria!))).toBe(70);
      expect((await clienteAdmin(farolas!).getEntity('farola', 'F10')).etag).toBe(antes.etag);
    });
  });

  it('no toca una farola existente aunque su posición difiera de la semilla, y solo da de alta las que faltan', async () => {
    await conTablasTemporales(['Farolas', 'Auditoria'], async ([farolas, auditoria]) => {
      const reubicada = { partitionKey: 'farola', rowKey: 'F07', calle: 'C. M', lat: 37.3, lon: -5.97, precision: 'verificada' };
      await clienteAdmin(farolas!).createEntity(reubicada);

      const resultado = await cargarFarolas(clientesDeCarga(farolas!, auditoria!), semilla);
      expect(resultado.existentes).toBe(1);
      expect(resultado.altas).toHaveLength(69);
      expect(resultado.altas).not.toContain('F07');
      expect(await clienteAdmin(farolas!).getEntity('farola', 'F07')).toMatchObject({ lat: 37.3, lon: -5.97 });

      const claves: string[] = [];
      for await (const e of clienteAdmin(auditoria!).listEntities<{ clave: string }>()) claves.push(e.clave);
      expect(claves).toHaveLength(69);
      expect(claves).not.toContain('F07');
    });
  });

  it('si la auditoría se rechaza, la farola no queda dada de alta', async () => {
    await conTablasTemporales(['Farolas', 'Auditoria'], async ([farolas, auditoria]) => {
      // SAS de Auditoria sin permiso de añadir: la entrada se rechaza con 403.
      const repo = new RepositorioFarolas(
        clienteConSas(farolas!, { query: true, add: true, delete: true }),
        clienteConSas(auditoria!, { query: true }),
      );
      await expect(cargarFarolas(repo, semilla)).rejects.toMatchObject({ statusCode: 403 });
      expect(await contar(clienteAdmin(farolas!))).toBe(0);
      expect(await contar(clienteAdmin(auditoria!))).toBe(0);
    });
  });
});
