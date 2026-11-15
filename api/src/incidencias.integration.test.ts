import { describe, expect, it } from 'vitest';
import { HaCambiado, RepositorioIncidencias, TransicionNoValida, YaAbierta } from './incidencias-repo';
import { clienteAdmin, clienteConSas, conTablasTemporales, contar, hayAzuriteConClave } from './pruebas/azurite';
import { UID_ANA, UID_BEA } from './pruebas/usuarios-dobles';

// Los permisos del SAS los fija tablas.test.ts contra infra/main.bicep. Azurite no restringe
// borrar la tabla ni MERGE con `rad` como Azure, así que aquí no se prueba lo que el SAS impide.
// Mismos permisos que INCIDENCIAS_CONNECTION (sp=raud) y AUDITORIA_CONNECTION (sp=ra) en infra/main.bicep.
function repo(incidencias: string, auditoria: string) {
  return new RepositorioIncidencias(
    clienteConSas(incidencias, { query: true, add: true, update: true, delete: true }),
    clienteConSas(auditoria, { query: true, add: true }),
  );
}

describe('Incidencias (Azurite)', () => {
  it.runIf(hayAzuriteConClave)('alta con el SAS de la app, sin duplicados y auditada sin el comentario', async () => {
    await conTablasTemporales(['Incidencias', 'Auditoria'], async ([incidencias, auditoria]) => {
      const r = repo(incidencias!, auditoria!);
      const creada = await r.crear({ farola: 'F07', comentario: 'Texto de prueba', autor: UID_ANA });
      expect(await r.abiertaDe('F07')).toEqual(creada);
      expect(await r.abiertas()).toEqual([creada]);

      await expect(r.crear({ farola: 'F07', comentario: '', autor: UID_BEA })).rejects.toBeInstanceOf(YaAbierta);
      expect(await contar(clienteAdmin(incidencias!))).toBe(2); // incidencia + candado

      const entradas = [];
      for await (const e of clienteAdmin(auditoria!).listEntities()) entradas.push(e);
      expect(entradas).toHaveLength(1);
      expect(entradas[0]).toMatchObject({ actor: UID_ANA, accion: 'incidencia.alta', clave: `F07/${creada.id}` });
      expect(JSON.stringify(entradas[0])).not.toContain('Texto de prueba');
    });
  });

  it.runIf(hayAzuriteConClave)('dos avisos simultáneos sobre la misma farola dejan una sola incidencia', async () => {
    await conTablasTemporales(['Incidencias', 'Auditoria'], async ([incidencias, auditoria]) => {
      const r = repo(incidencias!, auditoria!);
      const resultados = await Promise.allSettled(
        [UID_ANA, UID_BEA, UID_ANA].map((autor) => r.crear({ farola: 'F12', comentario: '', autor })),
      );
      expect(resultados.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      const rechazos = resultados.filter((x): x is PromiseRejectedResult => x.status === 'rejected');
      expect(rechazos.every((x) => x.reason instanceof YaAbierta)).toBe(true);
      expect(await contar(clienteAdmin(incidencias!))).toBe(2);
      expect(await contar(clienteAdmin(auditoria!))).toBe(1);
    });
  });

  it.runIf(hayAzuriteConClave)('si la auditoría falla se deshace el alta con el SAS de la app', async () => {
    await conTablasTemporales(['Incidencias', 'Auditoria'], async ([incidencias, auditoria]) => {
      // SAS de Auditoria solo de lectura: añadir falla con 403 y el alta se deshace.
      const r = new RepositorioIncidencias(
        clienteConSas(incidencias!, { query: true, add: true, delete: true }),
        clienteConSas(auditoria!, { query: true }),
      );
      await expect(r.crear({ farola: 'F07', comentario: '', autor: UID_ANA })).rejects.toMatchObject({ statusCode: 403 });
      expect(await contar(clienteAdmin(incidencias!))).toBe(0);
    });
  });

  it.runIf(hayAzuriteConClave)('la directiva avanza y completa una incidencia; la farola vuelve a admitir avisos (spec 007)', async () => {
    await conTablasTemporales(['Incidencias', 'Auditoria'], async ([incidencias, auditoria]) => {
      const r = repo(incidencias!, auditoria!);
      const creada = await r.crear({ farola: 'F07', comentario: 'Texto de prueba', autor: UID_ANA });

      await expect(r.cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Recibido', actor: UID_BEA })).resolves.toMatchObject({
        estado: 'Recibido',
      });
      await expect(
        r.cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Nuevo', actor: UID_BEA }),
      ).rejects.toBeInstanceOf(TransicionNoValida);
      await r.cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Completado', actor: UID_BEA });
      expect(await r.abiertas()).toEqual([]);

      const nueva = await r.crear({ farola: 'F07', comentario: '', autor: UID_ANA });
      expect(await r.abiertaDe('F07')).toEqual(nueva);

      const entradas: Record<string, unknown>[] = [];
      for await (const e of clienteAdmin(auditoria!).listEntities()) entradas.push(e);
      const cambios = entradas.filter((e) => e.accion === 'incidencia.estado');
      expect(cambios.map((e) => JSON.parse(String(e.despues)))).toEqual(
        expect.arrayContaining([{ estado: 'Recibido' }, { estado: 'Completado' }]),
      );
      expect(cambios).toHaveLength(2);
      expect(JSON.stringify(cambios)).not.toContain('Texto de prueba');
    });
  });

  it.runIf(hayAzuriteConClave)('dos cambios simultáneos sobre la misma incidencia: solo uno gana (spec 007)', async () => {
    await conTablasTemporales(['Incidencias', 'Auditoria'], async ([incidencias, auditoria]) => {
      const r = repo(incidencias!, auditoria!);
      const creada = await r.crear({ farola: 'F12', comentario: '', autor: UID_ANA });
      const resultados = await Promise.allSettled(
        [UID_ANA, UID_BEA].map((actor) => r.cambiarEstado({ farola: 'F12', id: creada.id, estado: 'Recibido', actor })),
      );
      expect(resultados.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      const rechazos = resultados.filter((x): x is PromiseRejectedResult => x.status === 'rejected');
      expect(rechazos.every((x) => x.reason instanceof HaCambiado || x.reason instanceof TransicionNoValida)).toBe(true);
      let cambios = 0;
      for await (const e of clienteAdmin(auditoria!).listEntities<{ accion: string }>()) if (e.accion === 'incidencia.estado') cambios++;
      expect(cambios).toBe(1);
    });
  });
});
