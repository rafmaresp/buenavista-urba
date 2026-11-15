import { describe, expect, it } from 'vitest';
import { clienteAdmin, clienteConSas, conTablasTemporales, esperarProhibido, hayAzuriteConClave } from './pruebas/azurite';
import { PARTICION_USUARIOS } from './usuarios';
import { RepositorioUsuarios } from './usuarios-repo';

const UID = '3c2b1a09-8f7e-4d6c-9b5a-493827160514';

// Mismos permisos que USUARIOS_CONNECTION (sp=ru) y AUDITORIA_CONNECTION (sp=ra) en infra/main.bicep.
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
        clienteConSas(usuarios!, { query: true, update: true }),
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

  it.runIf(hayAzuriteConClave)('el SAS de Usuarios de la app no da de alta ni borra usuarios', async () => {
    await conTablasTemporales(['Usuarios'], async ([usuarios]) => {
      await clienteAdmin(usuarios!).createEntity({ partitionKey: PARTICION_USUARIOS, rowKey: UID, sub: '' });
      const app = clienteConSas(usuarios!, { query: true, update: true });
      await esperarProhibido(app.createEntity({ partitionKey: PARTICION_USUARIOS, rowKey: 'otro', sub: '' }));
      await esperarProhibido(app.deleteEntity(PARTICION_USUARIOS, UID));
      await esperarProhibido(app.deleteTable());
    });
  });
});
