/** Cliente de /api/usuarios (contrato en specs/009-gestion-usuarios/contracts/api-usuarios.md). */

export type RolUsuario = 'comunero' | 'directiva';
export type EstadoUsuario = 'activo' | 'baja';

export interface UsuarioGestion {
  uid: string;
  email: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
  vinculado: boolean;
  propio: boolean;
}

/** fetch con el token de la sesión (Sesion.llamar). */
export type LlamarFn = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export type MotivoErrorUsuarios =
  | 'sin-acceso'
  | 'no-valido'
  | 'ya-existe'
  | 'propio-usuario'
  | 'usuario-cambiado'
  | 'no-encontrado'
  | 'no-disponible';

export class ErrorUsuarios extends Error {
  constructor(readonly motivo: MotivoErrorUsuarios) {
    super(`Gestión de usuarios: ${motivo}`);
    this.name = 'ErrorUsuarios';
  }
}

export function esUsuarioGestion(valor: unknown): valor is UsuarioGestion {
  if (typeof valor !== 'object' || valor === null) return false;
  const u = valor as Record<string, unknown>;
  return (
    typeof u['uid'] === 'string' &&
    typeof u['email'] === 'string' &&
    (u['rol'] === 'comunero' || u['rol'] === 'directiva') &&
    (u['estado'] === 'activo' || u['estado'] === 'baja') &&
    typeof u['vinculado'] === 'boolean' &&
    typeof u['propio'] === 'boolean'
  );
}

/** Traduce el status y el código de error de la API a un motivo. */
async function motivoDe(respuesta: Pick<Response, 'status' | 'json'>): Promise<MotivoErrorUsuarios> {
  const cuerpo = (await respuesta.json().catch(() => null)) as { error?: unknown } | null;
  const error = cuerpo?.error;
  if (respuesta.status === 401 || respuesta.status === 403) return 'sin-acceso';
  if (respuesta.status === 400) return 'no-valido';
  if (respuesta.status === 404) return 'no-encontrado';
  if (respuesta.status === 409 && (error === 'ya-existe' || error === 'propio-usuario' || error === 'usuario-cambiado')) return error;
  return 'no-disponible';
}

async function llamarSeguro(llamar: LlamarFn, url: string, init?: RequestInit) {
  try {
    return await llamar(url, init);
  } catch {
    throw new ErrorUsuarios('no-disponible');
  }
}

async function usuarioDe(respuesta: Pick<Response, 'json'>): Promise<UsuarioGestion> {
  const cuerpo = (await respuesta.json().catch(() => null)) as { usuario?: unknown } | null;
  if (!esUsuarioGestion(cuerpo?.usuario)) throw new ErrorUsuarios('no-disponible');
  return cuerpo.usuario;
}

/** GET /api/usuarios. */
export async function listarUsuarios(llamar: LlamarFn): Promise<UsuarioGestion[]> {
  const respuesta = await llamarSeguro(llamar, '/api/usuarios');
  if (!respuesta.ok) throw new ErrorUsuarios(await motivoDe(respuesta));
  const cuerpo = (await respuesta.json().catch(() => null)) as { usuarios?: unknown } | null;
  const usuarios = cuerpo?.usuarios;
  if (!Array.isArray(usuarios) || !usuarios.every(esUsuarioGestion)) throw new ErrorUsuarios('no-disponible');
  return usuarios;
}

/** POST /api/usuarios. */
export async function altaUsuario(llamar: LlamarFn, email: string, rol: RolUsuario): Promise<UsuarioGestion> {
  const respuesta = await llamarSeguro(llamar, '/api/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), rol }),
  });
  if (!respuesta.ok) throw new ErrorUsuarios(await motivoDe(respuesta));
  return usuarioDe(respuesta);
}

/** PATCH /api/usuarios/{uid}. */
export async function cambiarUsuario(
  llamar: LlamarFn,
  uid: string,
  cambio: { rol?: RolUsuario; estado?: EstadoUsuario },
): Promise<UsuarioGestion> {
  const respuesta = await llamarSeguro(llamar, `/api/usuarios/${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambio),
  });
  if (!respuesta.ok) throw new ErrorUsuarios(await motivoDe(respuesta));
  return usuarioDe(respuesta);
}
