import { describe, expect, it, vi } from 'vitest';
import { cargarUsuarios, ejecutarCargaUsuarios } from './carga-usuarios';
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

describe('ejecutarCargaUsuarios (script cargar-usuarios)', () => {
  it.each([{}, { USUARIOS_ALTA: '' }, { USUARIOS_ALTA: '  \n' }])('sin lista termina en 0 sin abrir las tablas (%j)', async (env) => {
    const crearRepo = vi.fn();
    expect(await ejecutarCargaUsuarios(env, crearRepo)).toEqual({
      salida: ['Sin USUARIOS_ALTA: no se da de alta a nadie.'],
      errores: [],
      codigo: 0,
    });
    expect(crearRepo).not.toHaveBeenCalled();
  });

  it('con lista válida da solo recuentos', async () => {
    const { repo } = preparar();
    const r = await ejecutarCargaUsuarios({ USUARIOS_ALTA: 'ana@example.com,comunero\nbea@example.com,directiva' }, () => repo);
    expect(r).toEqual({ salida: ['Lista: 2 usuarios. Ya existían: 1. Altas: 1.'], errores: [], codigo: 0 });
  });

  it('con lista inválida falla en 1 sin abrir las tablas y sin correos en la salida', async () => {
    const crearRepo = vi.fn();
    const r = await ejecutarCargaUsuarios({ USUARIOS_ALTA: 'ana@example.com,admin\nbea@example.com' }, crearRepo);
    expect(r.codigo).toBe(1);
    expect(r.errores).toHaveLength(3);
    expect([...r.salida, ...r.errores].join('\n')).not.toContain('@');
    expect(crearRepo).not.toHaveBeenCalled();
  });

  it('un error de tabla da solo nombre y código, nunca el mensaje con el SAS', async () => {
    const { repo, cliente } = preparar();
    cliente.listEntities.mockImplementation(() => {
      throw Object.assign(new Error('https://x?sig=secreto bea@example.com'), { name: 'RestError', statusCode: 403 });
    });
    const r = await ejecutarCargaUsuarios({ USUARIOS_ALTA: 'bea@example.com,comunero' }, () => repo);
    expect(r).toEqual({ salida: [], errores: ['La carga ha fallado: RestError 403'], codigo: 1 });
  });
});
