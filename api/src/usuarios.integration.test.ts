import { describe, expect, it } from 'vitest';
import { clienteAdmin, clienteConSas, conTablasTemporales, hayAzuriteConClave } from './pruebas/azurite';
import { PARTICION_USUARIOS } from './usuarios';
import { RepositorioUsuarios } from './usuarios-repo';

const UID = '3c2b1a09-8f7e-4d6c-9b5a-493827160514';

// Mismos permisos que USUARIOS_CONNECTION (sp=raud) y AUDITORIA_CONNECTION (sp=ra) en infra/main.bicep.
const SAS_APP = { query: true, add: true, update: true, delete: true };
describe('Usuarios (Azurite)', () => {
  it.runIf(hayAzuriteConClave)('la app vincula el sub con su SAS y la auditoría no lleva email ni sub', async () => {
    await conTablasTemporales(['Usuarios', 'Auditoria'], async ([usuarios, auditoria]) => {
      await clienteAdmin(usuarios!).createEntity({
        partitionKey: PARTICION_USUARIOS,
        rowKey: UID,
        email: 'prueba@example.com',
        sub: '',
        rol: 'comunero',
        estado: 'activo',
        alta: '2026-11-15T00:00:00.000Z',
        baja: '',
      });
      const repo = new RepositorioUsuarios(
        clienteConSas(usuarios!, SAS_APP),
        clienteConSas(auditoria!, { query: true, add: true }),
      );

      const [usuario] = await repo.buscarPorEmail('prueba@example.com');
      expect(usuario).toMatchObject({ uid: UID, rol: 'comunero', estado: 'activo', sub: '' });
      await repo.vincularSub(usuario!, 'sub-de-prueba');

      expect((await repo.buscarPorSub('sub-de-prueba')).map((u) => u.uid)).toEqual([UID]);
      const entradas = [];
      for await (const e of clienteAdmin(auditoria!).listEntities()) entradas.push(e);
      expect(entradas).toHaveLength(1);
      expect(entradas[0]).toMatchObject({ actor: UID, accion: 'usuario.vincular', clave: UID });
      expect(JSON.stringify(entradas[0])).not.toMatch(/example\.com|sub-de-prueba/);

      // Un ETag viejo (otro login vinculó antes) no pisa la fila.
      await expect(repo.vincularSub(usuario!, 'otro-sub')).rejects.toMatchObject({ statusCode: 412 });
    });
  });

  // Con `d`, Azurite deja borrar la tabla con un SAS de servicio; Azure no permite operaciones de tabla con
  // un SAS de servicio, así que esa garantía no se puede probar aquí (antes la cubría el SAS `ru`).

  it.runIf(hayAzuriteConClave)('la directiva da de alta, de baja y reactiva con el SAS de la app, todo auditado sin correo (010)', async () => {
    await conTablasTemporales(['Usuarios', 'Auditoria'], async ([usuarios, auditoria]) => {
      const repo = new RepositorioUsuarios(clienteConSas(usuarios!, SAS_APP), clienteConSas(auditoria!, { query: true, add: true }));
      const uid = await repo.crear({ email: 'nueva@example.com', rol: 'comunero' }, UID);
      expect(await repo.listar()).toMatchObject([{ uid, email: 'nueva@example.com', estado: 'activo', sub: '' }]);

      await repo.cambiar(uid, { estado: 'baja' }, UID);
      expect(await repo.leer(uid)).toMatchObject({ estado: 'baja', rol: 'comunero' });
      await repo.cambiar(uid, { estado: 'activo', rol: 'directiva' }, UID);
      expect(await repo.leer(uid)).toMatchObject({ estado: 'activo', rol: 'directiva', baja: '' });

      const entradas: { accion: string; actor: string; clave: string }[] = [];
      for await (const e of clienteAdmin(auditoria!).listEntities<{ accion: string; actor: string; clave: string }>()) entradas.push(e);
      expect(entradas.map((e) => e.accion).sort()).toEqual(['usuario.alta', 'usuario.cambio', 'usuario.cambio']);
      expect(entradas.every((e) => e.actor === UID && e.clave === uid)).toBe(true);
      expect(JSON.stringify(entradas)).not.toContain('example.com');

      // Un ETag viejo no pisa un cambio posterior.
      const viejo = (await repo.leer(uid))!;
      await clienteAdmin(usuarios!).updateEntity({ partitionKey: PARTICION_USUARIOS, rowKey: uid, rol: 'comunero' }, 'Merge');
      await expect(
        clienteConSas(usuarios!, SAS_APP).updateEntity({ partitionKey: PARTICION_USUARIOS, rowKey: uid, estado: 'baja' }, 'Merge', { etag: viejo.etag }),
      ).rejects.toMatchObject({ statusCode: 412 });
    });
  });
});
