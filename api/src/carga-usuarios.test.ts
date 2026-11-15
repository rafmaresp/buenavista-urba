import { describe, expect, it } from 'vitest';
import { cargarUsuarios } from './carga-usuarios';
import { auditoriaDoble, filaAna, tablaUsuarios } from './pruebas/usuarios-dobles';
import { RepositorioUsuarios } from './usuarios-repo';

function preparar() {
  const filas = [filaAna({ estado: 'baja' })];
  const { cliente, orden } = tablaUsuarios(filas);
  const auditoria = auditoriaDoble(orden);
  return { filas, cliente, auditoria, repo: new RepositorioUsuarios(cliente, auditoria) };
}

describe('cargarUsuarios', () => {
  it('da de alta solo los que faltan, con actor sistema:carga', async () => {
    const { repo, filas, auditoria } = preparar();
    const resultado = await cargarUsuarios(repo, [
      { email: 'ana@example.com', rol: 'comunero' },
      { email: 'bea@example.com', rol: 'directiva' },
    ]);
    expect(resultado).toEqual({ altas: 1, existentes: 1 });
    expect(filas.map((f) => [f.email, f.rol])).toEqual([
      ['ana@example.com', 'comunero'],
      ['bea@example.com', 'directiva'],
    ]);
    expect(auditoria.createEntity).toHaveBeenCalledTimes(1);
    expect(auditoria.createEntity.mock.calls[0]![0].actor).toBe('sistema:carga');
  });

  it('no cambia a un existente aunque la lista pida otro rol, ni a uno de baja', async () => {
    const { repo, filas, cliente, auditoria } = preparar();
    expect(await cargarUsuarios(repo, [{ email: 'ana@example.com', rol: 'directiva' }])).toEqual({ altas: 0, existentes: 1 });
    expect(filas).toEqual([filaAna({ estado: 'baja' })]);
    expect(cliente.createEntity).not.toHaveBeenCalled();
    expect(cliente.updateEntity).not.toHaveBeenCalled();
    expect(auditoria.createEntity).not.toHaveBeenCalled();
  });

  it('relanzar con la misma lista no da altas', async () => {
    const { repo, auditoria } = preparar();
    const lista = [{ email: 'bea@example.com', rol: 'comunero' as const }];
    await cargarUsuarios(repo, lista);
    expect(await cargarUsuarios(repo, lista)).toEqual({ altas: 0, existentes: 1 });
    expect(auditoria.createEntity).toHaveBeenCalledTimes(1);
  });

  it('una lista vacía no lee la tabla', async () => {
    const { repo, cliente } = preparar();
    expect(await cargarUsuarios(repo, [])).toEqual({ altas: 0, existentes: 0 });
    expect(cliente.listEntities).not.toHaveBeenCalled();
  });
});
