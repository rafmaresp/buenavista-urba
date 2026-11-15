import { describe, expect, it, vi } from 'vitest';
import type { EntidadAuditoria } from './auditoria';
import type { DepsIdentidad } from './identidad';
import { MAX_COMENTARIO, validarPeticion } from './incidencias';
import { type DepsIncidencias, respuestaCrear, respuestaListar } from './incidencias-http';
import { RepositorioIncidencias } from './incidencias-repo';
import { LimitePeticiones } from './limite';
import { tablaIncidencias } from './pruebas/incidencias-dobles';
import { UID_ANA, auditoriaDoble, filaAna, tablaUsuarios } from './pruebas/usuarios-dobles';
import { RepositorioUsuarios } from './usuarios-repo';

const CLIENT_ID = 'cliente-prueba.apps.googleusercontent.com';
const TOKEN = 'eyJ.token.firmado';
const CATALOGO = new Set(['F01', 'F07']);

function cabeceras(token: string | null = TOKEN) {
  return { get: (n: string) => (n.toLowerCase() === 'x-id-token' ? token : null) };
}

function preparar(opciones: { lecturaFalla?: boolean; auditoriaFalla?: boolean; estadoUsuario?: string } = {}) {
  const usuarios = tablaUsuarios([filaAna({ sub: 'google-ana', estado: opciones.estadoUsuario ?? 'activo' })]);
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
  const tabla = tablaIncidencias({ lecturaFalla: opciones.lecturaFalla });
  const entradas: EntidadAuditoria[] = [];
  const auditoria = {
    createEntity: async (e: EntidadAuditoria) => {
      if (opciones.auditoriaFalla) throw Object.assign(new Error('https://x?sig=secreto'), { name: 'RestError', statusCode: 500 });
      entradas.push(e);
    },
  };
  const deps: DepsIncidencias = {
    incidencias: () => new RepositorioIncidencias(tabla.cliente, auditoria),
    farolaExiste: vi.fn(async (id: string) => CATALOGO.has(id)),
    registrarError,
  };
  const crear = (cuerpo: unknown, token: string | null = TOKEN) =>
    respuestaCrear(cabeceras(token), async () => cuerpo, identidad, deps);
  return { deps, identidad, crear, tabla, entradas, registrarError };
}

const NO_STORE = { 'Cache-Control': 'no-store' };

describe('validarPeticion()', () => {
  it('acepta farola y comentario opcional, recortado', () => {
    expect(validarPeticion({ farola: 'F07' })).toEqual({ farola: 'F07', comentario: '' });
    expect(validarPeticion({ farola: 'F07', comentario: '  Parpadea  ', extra: 1 })).toEqual({ farola: 'F07', comentario: 'Parpadea' });
    expect(validarPeticion({ farola: 'F07', comentario: '   ' })).toEqual({ farola: 'F07', comentario: '' });
    expect(validarPeticion({ farola: 'F07', comentario: null })).toEqual({ farola: 'F07', comentario: '' });
  });

  it(`admite ${MAX_COMENTARIO} caracteres (contando emojis como uno) y rechaza uno más`, () => {
    expect(validarPeticion({ farola: 'F07', comentario: '💡'.repeat(MAX_COMENTARIO) })).toBeDefined();
    expect(validarPeticion({ farola: 'F07', comentario: 'a'.repeat(MAX_COMENTARIO + 1) })).toBeUndefined();
  });

  it.each([null, 'F07', [], {}, { farola: 'F7' }, { farola: 'F100' }, { farola: 'f07' }, { farola: 7 }, { farola: 'F07', comentario: 3 }])(
    'rechaza %j',
    (cuerpo) => expect(validarPeticion(cuerpo)).toBeUndefined(),
  );
});

describe('POST /api/incidencias (US1, US2)', () => {
  it('201 con la incidencia (sin autor ni comentario) y autor = uid del token', async () => {
    const { crear, tabla, entradas } = preparar();
    const r = await crear({ farola: 'F07', comentario: 'Parpadea' });
    expect(r.status).toBe(201);
    expect(r.headers).toEqual(NO_STORE);
    const { incidencia } = r.jsonBody as { incidencia: Record<string, unknown> };
    expect(Object.keys(incidencia).sort()).toEqual(['creada', 'estado', 'farola', 'id']);
    expect(incidencia).toMatchObject({ farola: 'F07', estado: 'Nuevo' });
    expect(tabla.filas.get(`F07|${String(incidencia['id'])}`)).toMatchObject({ autor: UID_ANA, comentario: 'Parpadea' });
    expect(entradas[0]).toMatchObject({ actor: UID_ANA });
  });

  it('sin token responde 401 y no lee el cuerpo', async () => {
    const { deps, identidad } = preparar();
    const leer = vi.fn(async () => ({ farola: 'F07' }));
    const r = await respuestaCrear(cabeceras(null), leer, identidad, deps);
    expect(r).toEqual({ status: 401, headers: NO_STORE, jsonBody: { error: 'no-autenticado' } });
    expect(leer).not.toHaveBeenCalled();
  });

  it('usuario de baja: 403 genérico y no escribe', async () => {
    const { crear, tabla } = preparar({ estadoUsuario: 'baja' });
    expect(await crear({ farola: 'F07' })).toEqual({ status: 403, headers: NO_STORE, jsonBody: { error: 'sin-acceso' } });
    expect(tabla.filas.size).toBe(0);
  });

  it('cuerpo que no es JSON: 400', async () => {
    const { deps, identidad } = preparar();
    const r = await respuestaCrear(cabeceras(), async () => Promise.reject(new SyntaxError('JSON')), identidad, deps);
    expect(r).toEqual({ status: 400, headers: NO_STORE, jsonBody: { error: 'peticion-no-valida' } });
  });

  it('farola fuera del catálogo o comentario largo: 400 sin escribir', async () => {
    const { crear, tabla, deps } = preparar();
    expect((await crear({ farola: 'F55' })).status).toBe(400);
    expect((await crear({ farola: 'F07', comentario: 'x'.repeat(281) })).status).toBe(400);
    expect(tabla.filas.size).toBe(0);
    expect(deps.farolaExiste).toHaveBeenCalledTimes(1);
  });

  it('segunda incidencia en la misma farola: 409 con la existente', async () => {
    const { crear } = preparar();
    const primera = await crear({ farola: 'F07' });
    const segunda = await crear({ farola: 'F07', comentario: 'Otra vez' });
    expect(segunda).toEqual({
      status: 409,
      headers: NO_STORE,
      jsonBody: { error: 'ya-abierta', incidencia: (primera.jsonBody as { incidencia: unknown }).incidencia },
    });
  });

  it('si la auditoría falla: 503 sin detalles, nada guardado y el log sin SAS ni comentario', async () => {
    const { crear, tabla, registrarError } = preparar({ auditoriaFalla: true });
    const r = await crear({ farola: 'F07', comentario: 'Texto privado' });
    expect(r).toEqual({ status: 503, headers: NO_STORE, jsonBody: { error: 'no-disponible' } });
    expect(tabla.filas.size).toBe(0);
    expect(registrarError).toHaveBeenCalledWith('POST /api/incidencias falló: RestError 500');
    expect(JSON.stringify(registrarError.mock.calls)).not.toMatch(/sig=|Texto privado|example\.com/);
  });
});

describe('GET /api/incidencias (US3)', () => {
  it('200 con las abiertas, sin autor ni comentario', async () => {
    const { crear, deps } = preparar();
    await crear({ farola: 'F07', comentario: 'Secreto' });
    const r = await respuestaListar(deps);
    expect(r.status).toBe(200);
    expect(r.headers).toEqual(NO_STORE);
    const { incidencias } = r.jsonBody as { incidencias: unknown[] };
    expect(incidencias).toHaveLength(1);
    expect(JSON.stringify(r.jsonBody)).not.toMatch(/Secreto|autor|comentario|0b9c4f3e/);
  });

  it('si falla la lectura: 500 genérico y log sin SAS', async () => {
    const { deps, registrarError } = preparar({ lecturaFalla: true });
    expect(await respuestaListar(deps)).toEqual({ status: 500, headers: NO_STORE, jsonBody: { error: 'no-disponible' } });
    expect(registrarError).toHaveBeenCalledWith('GET /api/incidencias falló: RestError 500');
  });
});
