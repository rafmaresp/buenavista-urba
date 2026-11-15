import { describe, expect, it } from 'vitest';
import { cargarUsuarios } from './carga-usuarios';
import { clienteAdmin, clienteConSas, conTablasTemporales, contar, esperarProhibido, hayAzuriteConClave } from './pruebas/azurite';
import { parsearAltas } from './usuarios';
import { RepositorioUsuarios } from './usuarios-repo';

// Con los mismos permisos que la carga de infra-desplegar.yml: Usuarios rad, Auditoria a.
function repoDeCarga(usuarios: string, auditoria: string): RepositorioUsuarios {
  return new RepositorioUsuarios(
    clienteConSas(usuarios, { query: true, add: true, delete: true }),
    clienteConSas(auditoria, { add: true }),
  );
}

describe.runIf(hayAzuriteConClave)('alta de usuarios (Azurite)', () => {
  const lista = parsearAltas('Ana@Example.com,directiva\nbea@example.com,comunero');

  it('da de alta a los que faltan, auditados sin correo, y relanzar no hace nada', async () => {
    await conTablasTemporales(['Usuarios', 'Auditoria'], async ([usuarios, auditoria]) => {
      expect(await cargarUsuarios(repoDeCarga(usuarios!, auditoria!), lista)).toEqual({ altas: 2, existentes: 0 });

      const filas: Record<string, unknown>[] = [];
      for await (const f of clienteAdmin(usuarios!).listEntities()) filas.push(f);
      expect(filas.map((f) => [f.email, f.rol, f.estado, f.sub, f.baja]).sort()).toEqual([
        ['ana@example.com', 'directiva', 'activo', '', ''],
        ['bea@example.com', 'comunero', 'activo', '', ''],
      ]);

      const entradas: Record<string, unknown>[] = [];
      for await (const e of clienteAdmin(auditoria!).listEntities()) entradas.push(e);
      expect(entradas).toHaveLength(2);
      expect(new Set(entradas.map((e) => e.clave))).toEqual(new Set(filas.map((f) => f.rowKey)));
      for (const e of entradas) {
        expect(e).toMatchObject({ actor: 'sistema:carga', accion: 'usuario.alta', entidad: 'Usuarios', antes: '' });
        expect(JSON.stringify(e)).not.toContain('@');
      }

      expect(await cargarUsuarios(repoDeCarga(usuarios!, auditoria!), lista)).toEqual({ altas: 0, existentes: 2 });
      expect(await contar(clienteAdmin(usuarios!))).toBe(2);
      expect(await contar(clienteAdmin(auditoria!))).toBe(2);
    });
  });

  it('con el SAS de la app (ru) no se puede dar de alta', async () => {
    await conTablasTemporales(['Usuarios', 'Auditoria'], async ([usuarios, auditoria]) => {
      const repoApp = new RepositorioUsuarios(
        clienteConSas(usuarios!, { query: true, update: true }),
        clienteConSas(auditoria!, { add: true, query: true }),
      );
      await esperarProhibido(repoApp.crear({ email: 'ana@example.com', rol: 'comunero' }, 'sistema:carga'));
      expect(await contar(clienteAdmin(auditoria!))).toBe(0);
    });
  });
});
