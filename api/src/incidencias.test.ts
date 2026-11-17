import { describe, expect, it, vi } from 'vitest';
import type { EntidadAuditoria } from './auditoria';
import type { DepsIdentidad } from './identidad';
import { ESTADOS, MAX_COMENTARIO, esPosterior, validarCambio, validarPeticion } from './incidencias';
import { type DepsIncidencias, respuestaCambiarEstado, respuestaCrear, respuestaListar } from './incidencias-http';
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

describe('validarCambio() (spec 009)', () => {
  const ID = '0b9c4f3e-6a1d-4c8e-9f2a-1d3e5b7c9a01';

  it('acepta id uuid, farola y un estado del ciclo; ignora campos de más', () => {
    for (const estado of ESTADOS) expect(validarCambio(ID, { farola: 'F07', estado, autor: 'x' })).toEqual({ id: ID, farola: 'F07', estado });
  });

  it.each([
    [undefined, { farola: 'F07', estado: 'Recibido' }],
    ['no-uuid', { farola: 'F07', estado: 'Recibido' }],
    [ID, { farola: 'F7', estado: 'Recibido' }],
    [ID, { farola: 'F07', estado: 'En curso' }],
    [ID, { farola: 'F07', estado: 'recibido' }],
    [ID, { farola: 'F07' }],
    [ID, null],
    [ID, ['F07', 'Recibido']],
  ])('rechaza id %s con cuerpo %j', (id, cuerpo) => {
    expect(validarCambio(id, cuerpo)).toBeUndefined();
  });

  it('esPosterior(): solo hacia delante, se pueden saltar estados', () => {
    expect(esPosterior('Nuevo', 'Recibido')).toBe(true);
    expect(esPosterior('Nuevo', 'Completado')).toBe(true);
    expect(esPosterior('Recibido', 'Recibido')).toBe(false);
    expect(esPosterior('Profesional notificado', 'Recibido')).toBe(false);
    expect(esPosterior('Completado', 'Completado')).toBe(false);
    expect(esPosterior('Desconocido', 'Completado')).toBe(false);
  });
});

describe('PUT /api/incidencias/{id} (spec 009)', () => {
  function prepararCambio(opciones: { rol?: string; estadoUsuario?: string; auditoriaFalla?: boolean } = {}) {
    const usuarios = tablaUsuarios([
      filaAna({ sub: 'google-ana', rol: opciones.rol ?? 'directiva', estado: opciones.estadoUsuario ?? 'activo' }),
    ]);
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
    const tabla = tablaIncidencias();
    const entradas: EntidadAuditoria[] = [];
    let auditoriaFalla = false;
    const auditoria = {
      createEntity: async (e: EntidadAuditoria) => {
        if (auditoriaFalla) throw Object.assign(new Error('https://x?sig=secreto'), { name: 'RestError', statusCode: 500 });
        entradas.push(e);
      },
    };
    const deps: DepsIncidencias = {
      incidencias: () => new RepositorioIncidencias(tabla.cliente, auditoria),
      farolaExiste: async () => true,
      registrarError,
    };
    const crearIncidencia = async () => {
      const i = await deps.incidencias().crear({ farola: 'F07', comentario: 'Privado', autor: UID_ANA });
      entradas.length = 0;
      auditoriaFalla = Boolean(opciones.auditoriaFalla);
      return i;
    };
    const cambiarConLector = (id: string | undefined, leer: () => Promise<unknown>, token: string | null = TOKEN) =>
      respuestaCambiarEstado(cabeceras(token), id, leer, identidad, deps);
    const cambiar = (id: string | undefined, cuerpo: unknown, token: string | null = TOKEN) =>
      cambiarConLector(id, async () => cuerpo, token);
    return { cambiar, cambiarConLector, crearIncidencia, tabla, entradas, registrarError };
  }

  it('la directiva cambia el estado: 200 con la incidencia pública y auditado con su uid', async () => {
    const { cambiar, crearIncidencia, entradas } = prepararCambio();
    const i = await crearIncidencia();
    const r = await cambiar(i.id, { farola: 'F07', estado: 'Recibido' });
    expect(r).toEqual({ status: 200, headers: NO_STORE, jsonBody: { incidencia: { ...i, estado: 'Recibido' } } });
    expect(JSON.stringify(r.jsonBody)).not.toContain('Privado');
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({ actor: UID_ANA, accion: 'incidencia.estado' });
  });

  it('sin token o con token no válido: 401 sin tocar la tabla', async () => {
    const { cambiar, crearIncidencia, tabla } = prepararCambio();
    const i = await crearIncidencia();
    tabla.cliente.getEntity.mockClear();
    expect((await cambiar(i.id, { farola: 'F07', estado: 'Recibido' }, null)).status).toBe(401);
    expect((await cambiar(i.id, { farola: 'F07', estado: 'Recibido' }, 'otro')).status).toBe(401);
    expect(tabla.cliente.getEntity).not.toHaveBeenCalled();
  });

  it('un comunero recibe el 403 genérico sin leer ni escribir incidencias (US3)', async () => {
    const { cambiar, crearIncidencia, tabla, entradas } = prepararCambio({ rol: 'comunero' });
    const i = await crearIncidencia();
    tabla.cliente.getEntity.mockClear();
    const r = await cambiar(i.id, { farola: 'F07', estado: 'Completado' });
    expect(r).toEqual({ status: 403, headers: NO_STORE, jsonBody: { error: 'sin-acceso' } });
    expect(tabla.cliente.getEntity).not.toHaveBeenCalled();
    expect(tabla.filas.get(`F07|${i.id}`)).toMatchObject({ estado: 'Nuevo' });
    expect(entradas).toHaveLength(0);
  });

  it('una directiva de baja recibe 403', async () => {
    const { cambiar, crearIncidencia } = prepararCambio({ estadoUsuario: 'baja' });
    const i = await crearIncidencia();
    expect((await cambiar(i.id, { farola: 'F07', estado: 'Recibido' })).status).toBe(403);
  });

  it('entrada no válida: 400 peticion-no-valida', async () => {
    const { cambiar, crearIncidencia } = prepararCambio();
    const i = await crearIncidencia();
    for (const [id, cuerpo] of [
      ['x', { farola: 'F07', estado: 'Recibido' }],
      [i.id, { farola: 'F07', estado: 'En curso' }],
      [i.id, 'texto'],
    ] as const) {
      expect(await cambiar(id, cuerpo)).toEqual({ status: 400, headers: NO_STORE, jsonBody: { error: 'peticion-no-valida' } });
    }
  });

  it('cuerpo que no es JSON: 400', async () => {
    const { cambiarConLector, crearIncidencia } = prepararCambio();
    const i = await crearIncidencia();
    const r = await cambiarConLector(i.id, async () => {
      throw new SyntaxError('no JSON');
    });
    expect(r.status).toBe(400);
  });

  it('incidencia que no es la abierta de esa farola: 404', async () => {
    const { cambiar, crearIncidencia } = prepararCambio();
    const i = await crearIncidencia();
    expect(await cambiar(i.id, { farola: 'F01', estado: 'Recibido' })).toEqual({
      status: 404,
      headers: NO_STORE,
      jsonBody: { error: 'no-encontrada' },
    });
  });

  it('volver atrás: 409 transicion-no-valida con la incidencia actual', async () => {
    const { cambiar, crearIncidencia } = prepararCambio();
    const i = await crearIncidencia();
    await cambiar(i.id, { farola: 'F07', estado: 'Profesional notificado' });
    expect(await cambiar(i.id, { farola: 'F07', estado: 'Recibido' })).toEqual({
      status: 409,
      headers: NO_STORE,
      jsonBody: { error: 'transicion-no-valida', incidencia: { ...i, estado: 'Profesional notificado' } },
    });
  });

  it('completar libera la farola: deja de listarse (US2)', async () => {
    const { cambiar, crearIncidencia } = prepararCambio();
    const i = await crearIncidencia();
    expect((await cambiar(i.id, { farola: 'F07', estado: 'Completado' })).status).toBe(200);
    expect((await cambiar(i.id, { farola: 'F07', estado: 'Completado' })).status).toBe(404);
  });

  it('si la auditoría falla: 503 sin detalles y el log sin el SAS ni el cuerpo', async () => {
    const { cambiar, crearIncidencia, tabla, registrarError } = prepararCambio({ auditoriaFalla: true });
    const i = await crearIncidencia();
    const r = await cambiar(i.id, { farola: 'F07', estado: 'Recibido' });
    expect(r).toEqual({ status: 503, headers: NO_STORE, jsonBody: { error: 'no-disponible' } });
    expect(tabla.filas.get(`F07|${i.id}`)).toMatchObject({ estado: 'Nuevo' });
    expect(registrarError).toHaveBeenCalledWith('PUT /api/incidencias falló: RestError 500');
    expect(JSON.stringify(registrarError.mock.calls)).not.toMatch(/sig=|Recibido|ana@/);
  });
});
