import { describe, expect, it, vi } from 'vitest';
import { type DatosToken, type DepsIdentidad, depsIdentidad, identificar } from './identidad';
import { LimitePeticiones } from './limite';
import { type FilaUsuario, UID_ANA, UID_BEA, auditoriaDoble, filaAna, tablaUsuarios } from './pruebas/usuarios-dobles';
import { RepositorioUsuarios } from './usuarios-repo';

const CLIENT_ID = 'cliente-prueba.apps.googleusercontent.com';
const TOKEN = 'eyJ.token.firmado';
const DATOS_ANA: DatosToken = { sub: 'google-ana', email: 'Ana@Example.com', email_verified: true };

function cabeceras(valores: Record<string, string> = { 'x-id-token': TOKEN }) {
  return { get: (n: string) => valores[n.toLowerCase()] ?? null };
}

function preparar(
  filas: FilaUsuario[] = [filaAna()],
  opciones: { datos?: DatosToken; tokenInvalido?: boolean; auditoriaFalla?: boolean; lecturaFalla?: boolean; clientId?: string; limite?: LimitePeticiones } = {},
) {
  const { cliente, orden } = tablaUsuarios(filas, { lecturaFalla: opciones.lecturaFalla });
  const auditoria = auditoriaDoble(orden, opciones.auditoriaFalla);
  const registrarError = vi.fn<(m: string) => void>();
  const verificar = vi.fn(async (token: string, audiencia: string) => {
    if (opciones.tokenInvalido || token !== TOKEN || audiencia !== CLIENT_ID) throw new Error(`Wrong recipient ${token}`);
    return opciones.datos ?? DATOS_ANA;
  });
  const deps: DepsIdentidad = {
    clientId: 'clientId' in opciones ? opciones.clientId : CLIENT_ID,
    verificar,
    usuarios: () => new RepositorioUsuarios(cliente, auditoria),
    limite: opciones.limite ?? new LimitePeticiones(),
    registrarError,
  };
  return { deps, filas, orden, auditoria, registrarError, verificar, cliente };
}

const SIN_ACCESO = { status: 403, headers: { 'Cache-Control': 'no-store' }, jsonBody: { error: 'sin-acceso' } };
const NO_AUTENTICADO = { status: 401, headers: { 'Cache-Control': 'no-store' }, jsonBody: { error: 'no-autenticado' } };

describe('identificar() — entra quien está en la lista (US1)', () => {
  it('primer login: busca por email normalizado, vincula el sub, audita y devuelve uid y rol', async () => {
    const { deps, filas, orden, verificar } = preparar();
    const r = await identificar(cabeceras(), deps);
    expect(r).toEqual({ ok: true, usuario: { uid: UID_ANA, rol: 'comunero' } });
    expect(verificar).toHaveBeenCalledWith(TOKEN, CLIENT_ID);
    expect(filas[0]!.sub).toBe('google-ana');
    expect(orden).toEqual([`vincular ${UID_ANA}`, `auditoria ${UID_ANA}`]);
  });

  it('siguientes logins: le identifica por sub sin escribir ni auditar', async () => {
    const { deps, orden } = preparar([filaAna({ sub: 'google-ana', email: 'otra@example.com' })]);
    expect(await identificar(cabeceras(), deps)).toEqual({ ok: true, usuario: { uid: UID_ANA, rol: 'comunero' } });
    expect(orden).toEqual([]);
  });

  it('devuelve el rol directiva de la tabla', async () => {
    const { deps } = preparar([filaAna({ rol: 'directiva' })]);
    expect(await identificar(cabeceras(), deps)).toMatchObject({ ok: true, usuario: { rol: 'directiva' } });
  });

  it('si la auditoría falla, deshace la vinculación y responde 503', async () => {
    const { deps, filas, registrarError } = preparar([filaAna()], { auditoriaFalla: true });
    const r = await identificar(cabeceras(), deps);
    expect(r).toMatchObject({ ok: false, respuesta: { status: 503, jsonBody: { error: 'no-disponible' } } });
    expect(filas[0]!.sub).toBe('');
    expect(registrarError).toHaveBeenCalledWith('Identificación falló: Error');
  });
});

describe('identificar() — primer login concurrente', () => {
  it('si otra petición vinculó antes (412), relee por sub y entra sin auditar de nuevo', async () => {
    const { deps, filas, orden } = preparar();
    // La fila cambió entre la lectura y la escritura: otra petición fijó el mismo sub.
    const repoOriginal = deps.usuarios();
    deps.usuarios = () => repoOriginal;
    const buscarPorEmail = repoOriginal.buscarPorEmail.bind(repoOriginal);
    repoOriginal.buscarPorEmail = async (email) => {
      const r = await buscarPorEmail(email);
      filas[0]!.sub = 'google-ana';
      filas[0]!.etag = 'W/"2"';
      return r;
    };
    expect(await identificar(cabeceras(), deps)).toEqual({ ok: true, usuario: { uid: UID_ANA, rol: 'comunero' } });
    expect(orden).toEqual([`vincular ${UID_ANA}`]);
  });

  it('si la fila quedó con otro sub tras el 412, 403', async () => {
    const { deps, filas } = preparar();
    const repoOriginal = deps.usuarios();
    deps.usuarios = () => repoOriginal;
    const buscarPorEmail = repoOriginal.buscarPorEmail.bind(repoOriginal);
    repoOriginal.buscarPorEmail = async (email) => {
      const r = await buscarPorEmail(email);
      filas[0]!.sub = 'google-otro';
      filas[0]!.etag = 'W/"2"';
      return r;
    };
    expect(await identificar(cabeceras(), deps)).toEqual({ ok: false, respuesta: SIN_ACCESO });
  });
});

describe('identificar() — quien no está autorizado no entra (US2)', () => {
  it('sin cabecera o con ella vacía: 401', async () => {
    const { deps, verificar } = preparar();
    expect(await identificar(cabeceras({}), deps)).toEqual({ ok: false, respuesta: NO_AUTENTICADO });
    expect(await identificar(cabeceras({ 'x-id-token': '  ' }), deps)).toEqual({ ok: false, respuesta: NO_AUTENTICADO });
    expect(verificar).not.toHaveBeenCalled();
  });

  it('ignora Authorization: solo vale X-Id-Token', async () => {
    const { deps } = preparar();
    expect(await identificar(cabeceras({ authorization: `Bearer ${TOKEN}` }), deps)).toEqual({ ok: false, respuesta: NO_AUTENTICADO });
  });

  it('token inválido, caducado o de otra audiencia: 401', async () => {
    const { deps } = preparar([filaAna()], { tokenInvalido: true });
    expect(await identificar(cabeceras(), deps)).toEqual({ ok: false, respuesta: NO_AUTENTICADO });
  });

  it('token sin sub: 401', async () => {
    const { deps } = preparar([filaAna()], { datos: { email: 'ana@example.com', email_verified: true } });
    expect(await identificar(cabeceras(), deps)).toEqual({ ok: false, respuesta: NO_AUTENTICADO });
  });

  it.each([
    ['email sin verificar', [filaAna()], { ...DATOS_ANA, email_verified: false }],
    ['token sin email', [filaAna()], { sub: 'google-ana', email_verified: true }],
    ['fuera de la lista', [filaAna({ email: 'otra@example.com' })], DATOS_ANA],
    ['de baja', [filaAna({ estado: 'baja' })], DATOS_ANA],
    ['suprimido', [filaAna({ estado: 'suprimido', email: '' })], DATOS_ANA],
    ['email ya vinculado a otro sub', [filaAna({ sub: 'google-otro' })], DATOS_ANA],
    ['rol desconocido', [filaAna({ rol: 'admin' })], DATOS_ANA],
    ['email duplicado', [filaAna(), filaAna({ rowKey: UID_BEA })], DATOS_ANA],
    ['sub duplicado', [filaAna({ sub: 'google-ana' }), filaAna({ rowKey: UID_BEA, sub: 'google-ana' })], DATOS_ANA],
  ] as const)('%s: 403 con el mismo cuerpo y sin vincular', async (_caso, filas, datos) => {
    const copia = filas.map((f) => ({ ...f }));
    const { deps, orden } = preparar(copia, { datos });
    expect(await identificar(cabeceras(), deps)).toEqual({ ok: false, respuesta: SIN_ACCESO });
    expect(orden).toEqual([]);
  });

  it('un usuario de baja no queda vinculado', async () => {
    const { deps, filas } = preparar([filaAna({ estado: 'baja' })]);
    await identificar(cabeceras(), deps);
    expect(filas[0]!.sub).toBe('');
  });

  it('sin GOOGLE_CLIENT_ID: 503 sin validar nada', async () => {
    const { deps, verificar } = preparar([filaAna()], { clientId: undefined });
    expect(await identificar(cabeceras(), deps)).toMatchObject({ ok: false, respuesta: { status: 503 } });
    expect(verificar).not.toHaveBeenCalled();
  });

  it('si la tabla falla: 503 y el registro no lleva la URL con el SAS', async () => {
    const { deps, registrarError } = preparar([filaAna()], { lecturaFalla: true });
    expect(await identificar(cabeceras(), deps)).toMatchObject({ ok: false, respuesta: { status: 503 } });
    expect(registrarError).toHaveBeenCalledWith('Identificación falló: RestError 500');
  });

  it('nada de lo registrado contiene el token, el email ni el sub', async () => {
    const casos = [
      preparar([filaAna(), filaAna({ rowKey: UID_BEA })]),
      preparar([filaAna()], { lecturaFalla: true }),
      preparar([filaAna()], { auditoriaFalla: true }),
      preparar([filaAna()], { tokenInvalido: true }),
    ];
    for (const { deps, registrarError } of casos) {
      const r = await identificar(cabeceras(), deps);
      const texto = JSON.stringify([registrarError.mock.calls, r]);
      expect(texto).not.toMatch(/example\.com|google-ana|eyJ/i);
    }
  });
});

describe('identificar() — límite de peticiones (US3)', () => {
  it('también limita a una cuenta de Google fuera de la lista, sin leer la tabla al pasarse', async () => {
    const limite = new LimitePeticiones(2, 60_000, () => 0);
    const fuera = preparar([filaAna({ email: 'otra@example.com' })], { limite });
    expect((await identificar(cabeceras(), fuera.deps)).ok).toBe(false);
    expect((await identificar(cabeceras(), fuera.deps)).ok).toBe(false);
    const lecturas = fuera.cliente.listEntities.mock.calls.length;
    const r = await identificar(cabeceras(), fuera.deps);
    expect(r).toMatchObject({ ok: false, respuesta: { status: 429 } });
    expect(fuera.cliente.listEntities.mock.calls.length).toBe(lecturas);
  });

  it('la petición 61 del mismo usuario en un minuto da 429 con Retry-After; otro usuario sigue entrando', async () => {
    const limite = new LimitePeticiones(60, 60_000, () => 0);
    const ana = preparar([filaAna({ sub: 'google-ana' })], { limite });
    for (let i = 0; i < 60; i++) expect((await identificar(cabeceras(), ana.deps)).ok).toBe(true);
    expect(await identificar(cabeceras(), ana.deps)).toEqual({
      ok: false,
      respuesta: { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' }, jsonBody: { error: 'demasiadas-peticiones' } },
    });

    const bea = preparar([filaAna({ rowKey: UID_BEA, sub: 'google-bea' })], { limite, datos: { ...DATOS_ANA, sub: 'google-bea' } });
    expect(await identificar(cabeceras(), bea.deps)).toMatchObject({ ok: true, usuario: { uid: UID_BEA } });
  });
});

describe('depsIdentidad()', () => {
  it('lee GOOGLE_CLIENT_ID y crea el repositorio con las tablas Usuarios y Auditoria', () => {
    const conexion = 'TableEndpoint=http://127.0.0.1:10002/dev;SharedAccessSignature=sv=1&sig=x';
    const deps = depsIdentidad(() => {}, {
      GOOGLE_CLIENT_ID: CLIENT_ID,
      USUARIOS_CONNECTION: conexion,
      AUDITORIA_CONNECTION: conexion,
    });
    expect(deps.clientId).toBe(CLIENT_ID);
    expect(deps.usuarios()).toBeInstanceOf(RepositorioUsuarios);
  });
});
