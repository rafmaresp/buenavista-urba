import { describe, expect, it, vi } from 'vitest';
import type { EntidadAuditoria } from './auditoria';
import type { DepsIdentidad } from './identidad';
import { LimitePeticiones } from './limite';
import { type FilaUsuario, UID_ANA, UID_BEA, auditoriaDoble, filaAna, filaBea, tablaUsuarios } from './pruebas/usuarios-dobles';
import { type DepsGestionUsuarios, respuestaAlta, respuestaCambiar, respuestaListar } from './usuarios-http';
import { RepositorioUsuarios } from './usuarios-repo';
import { respuestaYo } from './yo';

// Gestión de usuarios por la directiva (specs/009-gestion-usuarios). Ana es quien llama (directiva
// salvo que se diga otra cosa); Bea es otra vecina. Identidad y gestión leen la misma tabla doble.

const CLIENT_ID = 'cliente-prueba.apps.googleusercontent.com';
const TOKEN = 'eyJ.token.firmado';

function cabeceras(token: string | null = TOKEN) {
  return { get: (n: string) => (n.toLowerCase() === 'x-id-token' ? token : null) };
}

function preparar(
  opciones: {
    rol?: string;
    filas?: FilaUsuario[];
    auditoriaFalla?: boolean;
    borrarFalla?: boolean;
    restaurarFalla?: boolean;
    lecturaFalla?: boolean;
  } = {},
) {
  const filas = [filaAna({ sub: 'google-ana', rol: opciones.rol ?? 'directiva' }), ...(opciones.filas ?? [filaBea()])];
  const tabla = tablaUsuarios(filas, { borrarFalla: opciones.borrarFalla, restaurarFalla: opciones.restaurarFalla });
  const registrarError = vi.fn<(m: string) => void>();
  const identidad: DepsIdentidad = {
    clientId: CLIENT_ID,
    verificar: async (token) => {
      if (token !== TOKEN) throw new Error('token no válido');
      return { sub: 'google-ana', email: 'ana@example.com', email_verified: true };
    },
    usuarios: () => new RepositorioUsuarios(tabla.cliente, auditoriaDoble([])),
    limite: new LimitePeticiones(),
    registrarError,
  };
  const entradas: EntidadAuditoria[] = [];
  const auditoria = {
    createEntity: async (e: EntidadAuditoria) => {
      if (opciones.auditoriaFalla) throw Object.assign(new Error('https://x?sig=secreto'), { name: 'RestError', statusCode: 500 });
      entradas.push(e);
    },
  };
  const deps: DepsGestionUsuarios = {
    usuarios: () => {
      if (opciones.lecturaFalla) {
        const rota = tablaUsuarios(filas, { lecturaFalla: true });
        return new RepositorioUsuarios(rota.cliente, auditoria);
      }
      return new RepositorioUsuarios(tabla.cliente, auditoria);
    },
    registrarError,
  };
  return {
    filas,
    tabla,
    entradas,
    registrarError,
    identidad,
    deps,
    listar: (token: string | null = TOKEN) => respuestaListar(cabeceras(token), identidad, deps),
    alta: (cuerpo: unknown, token: string | null = TOKEN) => respuestaAlta(cabeceras(token), async () => cuerpo, identidad, deps),
    cambiar: (uid: string | undefined, cuerpo: unknown, token: string | null = TOKEN) =>
      respuestaCambiar(uid, cabeceras(token), async () => cuerpo, identidad, deps),
  };
}

const sinCorreoNiSub = (valor: unknown) => expect(JSON.stringify(valor)).not.toMatch(/example\.com|google-/);

describe('GET /api/usuarios', () => {
  it('la directiva ve la lista ordenada por correo, sin sub ni suprimidos, y su fila marcada como propia', async () => {
    const { listar } = preparar({
      filas: [filaBea({ estado: 'baja' }), filaAna({ rowKey: 'x', email: '', sub: '', estado: 'suprimido' })],
    });
    const r = await listar();
    expect(r.status).toBe(200);
    expect(r.headers['Cache-Control']).toBe('no-store');
    expect(r.jsonBody).toEqual({
      usuarios: [
        { uid: UID_ANA, email: 'ana@example.com', rol: 'directiva', estado: 'activo', vinculado: true, propio: true },
        { uid: UID_BEA, email: 'bea@example.com', rol: 'comunero', estado: 'baja', vinculado: true, propio: false },
      ],
    });
    expect(JSON.stringify(r.jsonBody)).not.toContain('google-');
  });

  it('sin token: 401', async () => {
    expect((await preparar().listar(null)).status).toBe(401);
  });

  it('un comunero: 403 sin-acceso y sin correos en la respuesta (SC-004)', async () => {
    const r = await preparar({ rol: 'comunero' }).listar();
    expect(r).toMatchObject({ status: 403, jsonBody: { error: 'sin-acceso' } });
    sinCorreoNiSub(r.jsonBody);
  });

  it('si la tabla falla: 503 y log sin URL con SAS', async () => {
    const { listar, registrarError } = preparar({ lecturaFalla: true });
    expect((await listar()).status).toBe(503);
    expect(registrarError.mock.calls.join('\n')).not.toContain('sig=');
  });
});

describe('POST /api/usuarios (US1)', () => {
  it('da de alta un correo normalizado, activo y sin vincular, auditado con el uid de la directiva y sin correo', async () => {
    const { alta, filas, entradas } = preparar();
    const r = await alta({ email: '  Carmen@Example.COM ', rol: 'comunero' });

    expect(r.status).toBe(201);
    const usuario = (r.jsonBody as { usuario: Record<string, unknown> }).usuario;
    expect(usuario).toMatchObject({ email: 'carmen@example.com', rol: 'comunero', estado: 'activo', vinculado: false, propio: false });
    expect(filas.find((f) => f.email === 'carmen@example.com')).toMatchObject({ estado: 'activo', sub: '' });
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({ actor: UID_ANA, accion: 'usuario.alta', clave: usuario['uid'] });
    expect(JSON.parse(entradas[0]!.despues)).toEqual({ rol: 'comunero', estado: 'activo' });
    sinCorreoNiSub(entradas);
  });

  it.each([
    ['un correo activo', 'bea@example.com', 'activo'],
    ['un correo de baja, con otras mayúsculas', 'BEA@example.com', 'baja'],
  ])('409 ya-existe con %s, sin crear ni auditar', async (_caso, email, estado) => {
    const { alta, filas, entradas } = preparar({ filas: [filaBea({ estado })] });
    const r = await alta({ email, rol: 'directiva' });
    expect(r).toMatchObject({ status: 409, jsonBody: { error: 'ya-existe' } });
    expect(filas).toHaveLength(2);
    expect(entradas).toEqual([]);
  });

  it.each([
    ['correo sin dominio', { email: 'carmen', rol: 'comunero' }],
    ['correo con espacios dentro', { email: 'car men@example.com', rol: 'comunero' }],
    ['rol desconocido', { email: 'carmen@example.com', rol: 'admin' }],
    ['sin rol', { email: 'carmen@example.com' }],
    ['claves de más', { email: 'carmen@example.com', rol: 'comunero', estado: 'activo' }],
    ['cuerpo nulo', null],
    ['una lista', [{ email: 'carmen@example.com', rol: 'comunero' }]],
  ])('400 con %s, sin escribir', async (_caso, cuerpo) => {
    const { alta, tabla } = preparar();
    expect(await alta(cuerpo)).toMatchObject({ status: 400, jsonBody: { error: 'peticion-no-valida' } });
    expect(tabla.cliente.createEntity).not.toHaveBeenCalled();
  });

  it('400 si el cuerpo no es JSON', async () => {
    const { identidad, deps } = preparar();
    const r = await respuestaAlta(cabeceras(), async () => Promise.reject(new SyntaxError('JSON')), identidad, deps);
    expect(r.status).toBe(400);
  });

  it('un comunero: 403 antes de mirar el cuerpo, sin crear', async () => {
    const { alta, tabla } = preparar({ rol: 'comunero' });
    expect((await alta({ email: 'x' })).status).toBe(403);
    expect(tabla.cliente.createEntity).not.toHaveBeenCalled();
  });

  it('si la auditoría falla: 503, el alta se borra y el log no lleva correo ni SAS', async () => {
    const { alta, filas, registrarError } = preparar({ auditoriaFalla: true });
    expect(await alta({ email: 'carmen@example.com', rol: 'comunero' })).toMatchObject({ status: 503 });
    expect(filas.map((f) => f.email)).not.toContain('carmen@example.com');
    const log = registrarError.mock.calls.join('\n');
    expect(log).toContain('RestError 500');
    expect(log).not.toMatch(/sig=|example\.com/);
  });

  it('si tampoco se puede borrar: 503 y un log que pide revisarlo a mano', async () => {
    const { alta, registrarError } = preparar({ auditoriaFalla: true, borrarFalla: true });
    expect((await alta({ email: 'carmen@example.com', rol: 'comunero' })).status).toBe(503);
    expect(registrarError.mock.calls.join('\n')).toMatch(/revísalo a mano/);
  });
});

describe('PATCH /api/usuarios/{uid} (US2, US3)', () => {
  it('da de baja: estado baja con fecha, auditado como usuario.cambio sin correo', async () => {
    const { cambiar, filas, entradas } = preparar();
    const r = await cambiar(UID_BEA, { estado: 'baja' });
    expect(r).toMatchObject({ status: 200, jsonBody: { usuario: { uid: UID_BEA, estado: 'baja', rol: 'comunero' } } });
    const bea = filas.find((f) => f.rowKey === UID_BEA)!;
    expect(bea.estado).toBe('baja');
    expect(Date.parse(bea.baja!)).not.toBeNaN();
    expect(entradas[0]).toMatchObject({ actor: UID_ANA, accion: 'usuario.cambio', clave: UID_BEA });
    expect(JSON.parse(entradas[0]!.antes)).toEqual({ rol: 'comunero', estado: 'activo' });
    expect(JSON.parse(entradas[0]!.despues)).toEqual({ rol: 'comunero', estado: 'baja' });
    sinCorreoNiSub(entradas);
  });

  it('reactiva con el mismo rol y vacía la fecha de baja', async () => {
    const { cambiar, filas } = preparar({ filas: [filaBea({ estado: 'baja', rol: 'directiva', baja: '2026-11-01T00:00:00.000Z' })] });
    const r = await cambiar(UID_BEA, { estado: 'activo' });
    expect(r).toMatchObject({ status: 200, jsonBody: { usuario: { estado: 'activo', rol: 'directiva' } } });
    expect(filas.find((f) => f.rowKey === UID_BEA)).toMatchObject({ estado: 'activo', baja: '' });
  });

  it('cambia el rol a directiva (US3)', async () => {
    const { cambiar, filas, entradas } = preparar();
    expect((await cambiar(UID_BEA, { rol: 'directiva' })).status).toBe(200);
    expect(filas.find((f) => f.rowKey === UID_BEA)!.rol).toBe('directiva');
    expect(JSON.parse(entradas[0]!.despues)).toEqual({ rol: 'directiva', estado: 'activo' });
  });

  it('sin nada que cambiar: 200 sin escribir ni auditar', async () => {
    const { cambiar, tabla, entradas } = preparar();
    expect((await cambiar(UID_BEA, { rol: 'comunero', estado: 'activo' })).status).toBe(200);
    expect(tabla.cliente.updateEntity).not.toHaveBeenCalled();
    expect(entradas).toEqual([]);
  });

  it.each([
    ['su rol', { rol: 'comunero' }],
    ['su estado', { estado: 'baja' }],
  ])('nadie puede cambiar %s propio: 409 propio-usuario sin escribir', async (_caso, cuerpo) => {
    const { cambiar, tabla } = preparar();
    expect(await cambiar(UID_ANA, cuerpo)).toMatchObject({ status: 409, jsonBody: { error: 'propio-usuario' } });
    expect(await cambiar(UID_ANA.toUpperCase(), cuerpo)).toMatchObject({ status: 409 });
    expect(tabla.cliente.updateEntity).not.toHaveBeenCalled();
  });

  it.each([
    ['uid sin forma de UUID', 'bea', { estado: 'baja' }],
    ['sin uid', undefined, { estado: 'baja' }],
    ['estado suprimido', UID_BEA, { estado: 'suprimido' }],
    ['rol desconocido', UID_BEA, { rol: 'admin' }],
    ['cuerpo vacío', UID_BEA, {}],
    ['claves de más', UID_BEA, { estado: 'baja', email: 'otra@example.com' }],
    ['cuerpo nulo', UID_BEA, null],
  ])('400 con %s', async (_caso, uid, cuerpo) => {
    const { cambiar, tabla } = preparar();
    expect(await cambiar(uid, cuerpo)).toMatchObject({ status: 400, jsonBody: { error: 'peticion-no-valida' } });
    expect(tabla.cliente.updateEntity).not.toHaveBeenCalled();
  });

  it('404 si no existe o está suprimido', async () => {
    const { cambiar } = preparar({ filas: [filaBea({ estado: 'suprimido', email: '', sub: '' })] });
    expect(await cambiar(UID_BEA, { estado: 'activo' })).toMatchObject({ status: 404, jsonBody: { error: 'no-encontrado' } });
    expect((await cambiar('5d4c3b2a-1908-4f7e-8d6c-5b4a39281706', { estado: 'baja' })).status).toBe(404);
  });

  it('409 usuario-cambiado si otra escritura llegó antes (ETag), sin auditar', async () => {
    const { cambiar, tabla, entradas } = preparar();
    tabla.cliente.updateEntity.mockRejectedValueOnce(Object.assign(new Error('precondición'), { statusCode: 412 }));
    expect(await cambiar(UID_BEA, { estado: 'baja' })).toMatchObject({ status: 409, jsonBody: { error: 'usuario-cambiado' } });
    expect(entradas).toEqual([]);
  });

  it('un comunero: 403 sin leer ni escribir', async () => {
    const { cambiar, tabla } = preparar({ rol: 'comunero' });
    expect((await cambiar(UID_BEA, { estado: 'baja' })).status).toBe(403);
    expect(tabla.cliente.getEntity).not.toHaveBeenCalled();
    expect(tabla.cliente.updateEntity).not.toHaveBeenCalled();
  });

  it('si la auditoría falla: 503 y el usuario vuelve a su rol, estado y fecha de baja', async () => {
    const { cambiar, filas, tabla } = preparar({ auditoriaFalla: true });
    expect((await cambiar(UID_BEA, { estado: 'baja', rol: 'directiva' })).status).toBe(503);
    expect(filas.find((f) => f.rowKey === UID_BEA)).toMatchObject({ estado: 'activo', rol: 'comunero' });
    expect(tabla.orden).toEqual([`cambiar ${UID_BEA}`, `restaurar ${UID_BEA}`]);
  });

  it('si tampoco se puede restaurar: 503 y un log que pide revisarlo a mano', async () => {
    const { cambiar, registrarError } = preparar({ auditoriaFalla: true, restaurarFalla: true });
    expect((await cambiar(UID_BEA, { estado: 'baja' })).status).toBe(503);
    expect(registrarError.mock.calls.join('\n')).toMatch(/revísalo a mano/);
  });

  it('tras la baja, la siguiente petición de esa persona recibe 403 y al reactivar vuelve a entrar (FR-009)', async () => {
    const { cambiar, identidad } = preparar();
    const comoBea = { ...identidad, verificar: async () => ({ sub: 'google-bea', email: 'bea@example.com', email_verified: true }) };
    expect((await respuestaYo(cabeceras(), comoBea)).status).toBe(200);
    await cambiar(UID_BEA, { estado: 'baja' });
    expect(await respuestaYo(cabeceras(), comoBea)).toMatchObject({ status: 403, jsonBody: { error: 'sin-acceso' } });
    await cambiar(UID_BEA, { estado: 'activo' });
    expect(await respuestaYo(cabeceras(), comoBea)).toMatchObject({ status: 200, jsonBody: { rol: 'comunero' } });
  });
});
