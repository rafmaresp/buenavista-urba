import { describe, expect, it, vi } from 'vitest';
import type { EntidadAuditoria } from './auditoria';
import { type DepsFarolas, respuestaReubicar } from './farolas-http';
import { type ClienteTablaFarolas, RepositorioFarolas } from './farolas-repo';
import type { DepsIdentidad } from './identidad';
import { LimitePeticiones } from './limite';
import { UID_ANA, auditoriaDoble, filaAna, tablaUsuarios } from './pruebas/usuarios-dobles';
import { RepositorioUsuarios } from './usuarios-repo';

const CLIENT_ID = 'cliente-prueba.apps.googleusercontent.com';
const TOKEN = 'eyJ.token.firmado';
const NUEVA = { lat: 37.3101, lon: -5.9602 };

function cabeceras(token: string | null = TOKEN) {
  return { get: (n: string) => (n.toLowerCase() === 'x-id-token' ? token : null) };
}

function preparar(opciones: { rol?: string; auditoriaFalla?: boolean; restaurarFalla?: boolean } = {}) {
  const usuarios = tablaUsuarios([filaAna({ sub: 'google-ana', rol: opciones.rol ?? 'directiva' })]);
  const registrarError = vi.fn<(m: string) => void>();
  const identidad: DepsIdentidad = {
    clientId: CLIENT_ID,
    verificar: async (token) => {
      if (token !== TOKEN) throw new Error('token no válido');
      return { sub: 'google-ana', email: 'ana@example.com', email_verified: true };
    },
    usuarios: () => new RepositorioUsuarios(usuarios.cliente, auditoriaDoble(usuarios.orden)),
    limite: new LimitePeticiones(),
    registrarError,
  };

  let fila = { calle: 'C. M', lat: 37.31, lon: -5.96, precision: 'estimada', etag: 'W/"1"' };
  const farolas = {
    listEntities: vi.fn(),
    createEntity: vi.fn(),
    deleteEntity: vi.fn(),
    getEntity: vi.fn(async <T extends object>(_pk: string, rk: string) => {
      if (rk !== 'F07') throw Object.assign(new Error('https://x?sig=secreto'), { name: 'RestError', statusCode: 404 });
      return { ...fila } as unknown as T & { etag: string };
    }),
    updateEntity: vi.fn(async (e: { lat: number; lon: number; precision: string }) => {
      if (e.precision === 'estimada' && opciones.restaurarFalla) throw new Error('Table no disponible');
      fila = { ...fila, lat: e.lat, lon: e.lon, precision: e.precision, etag: 'W/"2"' };
      return { etag: fila.etag };
    }),
  } satisfies ClienteTablaFarolas;
  const entradas: EntidadAuditoria[] = [];
  const auditoria = {
    createEntity: async (e: EntidadAuditoria) => {
      if (opciones.auditoriaFalla) throw Object.assign(new Error('https://x?sig=secreto'), { name: 'RestError', statusCode: 500 });
      entradas.push(e);
    },
  };
  const deps: DepsFarolas = { farolas: () => new RepositorioFarolas(farolas, auditoria), registrarError };
  const reubicar = (id: string | undefined, cuerpo: unknown, token: string | null = TOKEN) =>
    respuestaReubicar(id, cabeceras(token), async () => cuerpo, identidad, deps);
  return { reubicar, farolas, entradas, registrarError, fila: () => fila, identidad, deps };
}

describe('PUT /api/farolas/{id}', () => {
  it('la directiva reubica: 200 con la farola pública (sin precisión) y auditoría con su uid (US1)', async () => {
    const { reubicar, entradas, fila } = preparar();
    const r = await reubicar('F07', { ...NUEVA, calle: 'Otra calle' });

    expect(r.status).toBe(200);
    expect(r.headers['Cache-Control']).toBe('no-store');
    expect(r.jsonBody).toEqual({ farola: { id: 'F07', calle: 'C. M', lat: 37.3101, lon: -5.9602 } });
    expect(fila()).toMatchObject({ calle: 'C. M', lat: 37.3101, precision: 'verificada' });
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({ actor: UID_ANA, accion: 'farola.reubicacion', clave: 'F07' });
    expect(JSON.stringify(entradas[0])).not.toContain('ana@example.com');
  });

  it('sin token: 401 sin tocar la tabla (US3)', async () => {
    const { reubicar, farolas, entradas } = preparar();
    const r = await reubicar('F07', NUEVA, null);
    expect(r).toMatchObject({ status: 401, jsonBody: { error: 'no-autenticado' } });
    expect(farolas.getEntity).not.toHaveBeenCalled();
    expect(entradas).toEqual([]);
  });

  it('un comunero: 403 sin-acceso sin leer ni escribir Farolas ni auditar (US3)', async () => {
    const { reubicar, farolas, entradas } = preparar({ rol: 'comunero' });
    const r = await reubicar('F07', NUEVA);
    expect(r).toMatchObject({ status: 403, jsonBody: { error: 'sin-acceso' } });
    expect(farolas.getEntity).not.toHaveBeenCalled();
    expect(farolas.updateEntity).not.toHaveBeenCalled();
    expect(entradas).toEqual([]);
  });

  it('el rol se comprueba antes que la petición: un comunero con cuerpo no válido recibe 403', async () => {
    const { reubicar } = preparar({ rol: 'comunero' });
    expect((await reubicar('X', null)).status).toBe(403);
  });

  it.each([
    ['id con otro formato', 'F7', NUEVA],
    ['id de tres cifras', 'F100', NUEVA],
    ['sin id', undefined, NUEVA],
    ['fuera de la urbanización', 'F07', { lat: 40.4, lon: -3.7 }],
    ['coordenadas como texto', 'F07', { lat: '37.31', lon: '-5.96' }],
    ['cuerpo vacío', 'F07', null],
  ])('400 si %s, sin escribir', async (_caso, id, cuerpo) => {
    const { reubicar, farolas } = preparar();
    const r = await reubicar(id, cuerpo);
    expect(r).toMatchObject({ status: 400, jsonBody: { error: 'peticion-no-valida' } });
    expect(farolas.updateEntity).not.toHaveBeenCalled();
  });

  it('400 si el cuerpo no es JSON', async () => {
    const { identidad, deps } = preparar();
    const r = await respuestaReubicar('F07', cabeceras(), async () => Promise.reject(new SyntaxError('JSON')), identidad, deps);
    expect(r.status).toBe(400);
  });

  it('404 si la farola no existe, sin crearla', async () => {
    const { reubicar, farolas } = preparar();
    const r = await reubicar('F99', NUEVA);
    expect(r).toMatchObject({ status: 404, jsonBody: { error: 'no-encontrada' } });
    expect(farolas.updateEntity).not.toHaveBeenCalled();
  });

  it('409 si otro la cambió entretanto', async () => {
    const { reubicar, farolas } = preparar();
    farolas.updateEntity.mockRejectedValueOnce(Object.assign(new Error('precondición'), { statusCode: 412 }));
    const r = await reubicar('F07', NUEVA);
    expect(r).toMatchObject({ status: 409, jsonBody: { error: 'farola-cambiada' } });
  });

  it('si la auditoría falla: 503, farola restaurada y log sin URL ni coordenadas (US2)', async () => {
    const { reubicar, fila, registrarError } = preparar({ auditoriaFalla: true });
    const r = await reubicar('F07', NUEVA);
    expect(r).toMatchObject({ status: 503, jsonBody: { error: 'no-disponible' } });
    expect(fila()).toMatchObject({ lat: 37.31, lon: -5.96, precision: 'estimada' });
    const log = registrarError.mock.calls.map((c) => c[0]).join('\n');
    expect(log).toContain('RestError 500');
    expect(log).not.toContain('sig=');
    expect(log).not.toContain('37.3101');
  });

  it('si tampoco se puede restaurar: 503 y un log que pide revisarlo a mano', async () => {
    const { reubicar, registrarError } = preparar({ auditoriaFalla: true, restaurarFalla: true });
    const r = await reubicar('F07', NUEVA);
    expect(r.status).toBe(503);
    expect(registrarError).toHaveBeenCalledWith('PUT /api/farolas/F07: reubicada sin auditar ni restaurar; revisar a mano');
  });
});
