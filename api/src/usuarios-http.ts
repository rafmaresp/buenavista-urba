import type { RespuestaHttp } from './farolas';
import { type Cabeceras, type DepsIdentidad, type UsuarioIdentificado, identificar } from './identidad';
import { type Usuario, esUid, validarAlta, validarCambio } from './usuarios';
import {
  AltaUsuarioSinAuditar,
  CambioUsuarioSinAuditar,
  type RepositorioUsuarios,
  UsuarioCambiado,
  UsuarioNoEncontrado,
} from './usuarios-repo';

/**
 * Gestión de la lista cerrada por la directiva (specs/010-gestion-usuarios). Orden en cada ruta:
 * identidad → rol directiva → petición → repositorio. Ni el cuerpo ni los correos se registran.
 */

export interface DepsGestionUsuarios {
  usuarios: () => RepositorioUsuarios;
  registrarError: (mensaje: string) => void;
}

/** Lo que ve la directiva de cada usuario: nunca el `sub` ni el ETag. */
export interface VistaUsuario {
  uid: string;
  email: string;
  rol: string;
  estado: string;
  vinculado: boolean;
  propio: boolean;
}

const NO_STORE = { 'Cache-Control': 'no-store' };

function respuesta(status: number, jsonBody: unknown): RespuestaHttp {
  return { status, headers: NO_STORE, jsonBody };
}

const NO_VALIDA = () => respuesta(400, { error: 'peticion-no-valida' });
const NO_DISPONIBLE = () => respuesta(503, { error: 'no-disponible' });

/** Solo el nombre y el código: el mensaje de un RestError puede llevar la URL con el SAS. */
function describir(e: unknown): string {
  const error = e as { name?: string; statusCode?: number };
  return `${error.name ?? 'Error'} ${error.statusCode ?? ''}`.trim();
}

export function vista(u: Usuario, quien: string): VistaUsuario {
  return { uid: u.uid, email: u.email, rol: u.rol, estado: u.estado, vinculado: Boolean(u.sub), propio: u.uid === quien };
}

type Guardia = { ok: true; usuario: UsuarioIdentificado } | { ok: false; respuesta: RespuestaHttp };

async function soloDirectiva(cabeceras: Cabeceras, identidad: DepsIdentidad): Promise<Guardia> {
  const quien = await identificar(cabeceras, identidad);
  if (!quien.ok) return quien;
  if (quien.usuario.rol !== 'directiva') return { ok: false, respuesta: respuesta(403, { error: 'sin-acceso' }) };
  return quien;
}

async function leerJson(leerCuerpo: () => Promise<unknown>): Promise<{ ok: true; cuerpo: unknown } | { ok: false }> {
  try {
    return { ok: true, cuerpo: await leerCuerpo() };
  } catch {
    return { ok: false };
  }
}

/** GET /api/usuarios: la lista sin suprimidos, ordenada por correo. */
export async function respuestaListar(
  cabeceras: Cabeceras,
  identidad: DepsIdentidad,
  deps: DepsGestionUsuarios,
): Promise<RespuestaHttp> {
  const quien = await soloDirectiva(cabeceras, identidad);
  if (!quien.ok) return quien.respuesta;
  try {
    const usuarios = await deps.usuarios().listar();
    usuarios.sort((a, b) => a.email.localeCompare(b.email));
    return respuesta(200, { usuarios: usuarios.map((u) => vista(u, quien.usuario.uid)) });
  } catch (e) {
    deps.registrarError(`GET /api/usuarios falló: ${describir(e)}`);
    return NO_DISPONIBLE();
  }
}

/** POST /api/usuarios: alta de un correo con rol; 409 si ya está en la lista. */
export async function respuestaAlta(
  cabeceras: Cabeceras,
  leerCuerpo: () => Promise<unknown>,
  identidad: DepsIdentidad,
  deps: DepsGestionUsuarios,
): Promise<RespuestaHttp> {
  const quien = await soloDirectiva(cabeceras, identidad);
  if (!quien.ok) return quien.respuesta;
  const leido = await leerJson(leerCuerpo);
  if (!leido.ok) return NO_VALIDA();
  const alta = validarAlta(leido.cuerpo);
  if (!alta) return NO_VALIDA();

  try {
    const repo = deps.usuarios();
    if ((await repo.buscarPorEmail(alta.email)).length) return respuesta(409, { error: 'ya-existe' });
    const uid = await repo.crear(alta, quien.usuario.uid);
    const creado: Usuario = { uid, email: alta.email, sub: '', rol: alta.rol, estado: 'activo', baja: '', etag: '' };
    return respuesta(201, { usuario: vista(creado, quien.usuario.uid) });
  } catch (e) {
    if (e instanceof AltaUsuarioSinAuditar) {
      deps.registrarError(`POST /api/usuarios: ${e.message}`);
    } else {
      deps.registrarError(`POST /api/usuarios falló: ${describir(e)}`);
    }
    return NO_DISPONIBLE();
  }
}

/** PATCH /api/usuarios/{uid}: cambia rol y/o estado (activo o baja); nunca el propio. */
export async function respuestaCambiar(
  uid: string | undefined,
  cabeceras: Cabeceras,
  leerCuerpo: () => Promise<unknown>,
  identidad: DepsIdentidad,
  deps: DepsGestionUsuarios,
): Promise<RespuestaHttp> {
  const quien = await soloDirectiva(cabeceras, identidad);
  if (!quien.ok) return quien.respuesta;
  if (!esUid(uid)) return NO_VALIDA();
  const leido = await leerJson(leerCuerpo);
  if (!leido.ok) return NO_VALIDA();
  const cambio = validarCambio(leido.cuerpo);
  if (!cambio) return NO_VALIDA();
  if (uid.toLowerCase() === quien.usuario.uid.toLowerCase()) return respuesta(409, { error: 'propio-usuario' });

  try {
    const usuario = await deps.usuarios().cambiar(uid, cambio, quien.usuario.uid);
    return respuesta(200, { usuario: vista(usuario, quien.usuario.uid) });
  } catch (e) {
    if (e instanceof UsuarioNoEncontrado) return respuesta(404, { error: 'no-encontrado' });
    if (e instanceof UsuarioCambiado) return respuesta(409, { error: 'usuario-cambiado' });
    if (e instanceof CambioUsuarioSinAuditar) {
      deps.registrarError(`PATCH /api/usuarios/${uid}: ${e.message}`);
    } else {
      deps.registrarError(`PATCH /api/usuarios/${uid} falló: ${describir(e)}`);
    }
    return NO_DISPONIBLE();
  }
}
