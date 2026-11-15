import { createHash } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import type { RespuestaHttp } from './farolas';
import { LimitePeticiones } from './limite';
import { tablaClient } from './tablas';
import { type Rol, type Usuario, esRol, normalizarEmail } from './usuarios';
import { RepositorioUsuarios } from './usuarios-repo';

/**
 * Único punto de identidad y rol de la API (constitución IV). Toda Function no pública lo llama
 * en cada petición: valida el ID token de Google y lee el rol y el estado de la tabla Usuarios.
 * Nada de lo que manda el cliente, salvo el token, decide quién es ni qué rol tiene.
 *
 * Privacidad: ni el token, ni el email, ni el `sub` salen en logs, errores ni respuestas.
 */

/** Cabecera del token. No se usa Authorization: SWA puede sustituirla en la API gestionada (research.md). */
export const CABECERA_TOKEN = 'x-id-token';

export interface DatosToken {
  sub?: string;
  email?: string;
  email_verified?: boolean;
}

/** Valida firma, emisor, audiencia y caducidad; lanza si algo falla. */
export type VerificadorToken = (token: string, audiencia: string) => Promise<DatosToken>;

export interface DepsIdentidad {
  clientId: string | undefined;
  verificar: VerificadorToken;
  usuarios: () => RepositorioUsuarios;
  limite: LimitePeticiones;
  registrarError: (mensaje: string) => void;
}

export interface UsuarioIdentificado {
  uid: string;
  rol: Rol;
}

export type ResultadoIdentidad = { ok: true; usuario: UsuarioIdentificado } | { ok: false; respuesta: RespuestaHttp };

const NO_STORE = { 'Cache-Control': 'no-store' };

function fallo(status: number, error: string, extra: Record<string, string> = {}): ResultadoIdentidad {
  return { ok: false, respuesta: { status, headers: { ...NO_STORE, ...extra }, jsonBody: { error } } };
}

const NO_AUTENTICADO = () => fallo(401, 'no-autenticado');
/** Siempre el mismo cuerpo: no revela si el email está en la lista ni por qué no entra. */
const SIN_ACCESO = () => fallo(403, 'sin-acceso');
const NO_DISPONIBLE = () => fallo(503, 'no-disponible');

export interface Cabeceras {
  get(nombre: string): string | null;
}

export async function identificar(cabeceras: Cabeceras, deps: DepsIdentidad): Promise<ResultadoIdentidad> {
  const token = cabeceras.get(CABECERA_TOKEN)?.trim();
  if (!token) return NO_AUTENTICADO();
  if (!deps.clientId) {
    deps.registrarError('Falta el app setting GOOGLE_CLIENT_ID');
    return NO_DISPONIBLE();
  }

  let datos: DatosToken;
  try {
    datos = await deps.verificar(token, deps.clientId);
  } catch {
    return NO_AUTENTICADO();
  }
  if (!datos.sub) return NO_AUTENTICADO();
  // El límite va antes de leer la tabla y por `sub` (hasheado en memoria): también frena a quien,
  // con una cuenta de Google válida pero fuera de la lista, repite peticiones que cuestan lecturas.
  const limite = deps.limite.consumir(createHash('sha256').update(datos.sub).digest('base64url'));
  if (!limite.permitido) {
    return fallo(429, 'demasiadas-peticiones', { 'Retry-After': String(limite.reintentarEnS) });
  }
  if (datos.email_verified !== true || !datos.email) return SIN_ACCESO();

  let usuario: Usuario;
  try {
    const repo = deps.usuarios();
    const encontrado = await buscarUsuario(repo, datos.sub, normalizarEmail(datos.email), deps.registrarError);
    if (!encontrado) return SIN_ACCESO();
    usuario = encontrado;
    if (usuario.estado !== 'activo' || !esRol(usuario.rol)) return SIN_ACCESO();
    if (!usuario.sub) {
      const vinculado = await vincularOReleer(repo, usuario, datos.sub);
      if (!vinculado) return SIN_ACCESO();
      usuario = vinculado;
    }
  } catch (e) {
    // Solo el nombre y el código: el mensaje de un RestError puede llevar la URL con el SAS.
    const error = e as { name?: string; statusCode?: number };
    deps.registrarError(`Identificación falló: ${error.name ?? 'Error'} ${error.statusCode ?? ''}`.trim());
    return NO_DISPONIBLE();
  }

  return { ok: true, usuario: { uid: usuario.uid, rol: usuario.rol as Rol } };
}

/**
 * Vincula el `sub`. Si otra petición del mismo primer login lo vinculó antes (412 por el ETag),
 * se relee por `sub` en lugar de fallar; si la fila quedó con otro `sub`, no hay acceso.
 */
async function vincularOReleer(repo: RepositorioUsuarios, usuario: Usuario, sub: string): Promise<Usuario | undefined> {
  try {
    await repo.vincularSub(usuario, sub);
    return usuario;
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode !== 412) throw e;
    const releido = await repo.buscarPorSub(sub);
    return releido.length === 1 && releido[0]!.estado === 'activo' && esRol(releido[0]!.rol) ? releido[0] : undefined;
  }
}

/** Por `sub` si ya está vinculado; si no, por email, y solo si esa fila aún no tiene otro `sub`. */
async function buscarUsuario(
  repo: RepositorioUsuarios,
  sub: string,
  email: string,
  registrarError: (mensaje: string) => void,
): Promise<Usuario | undefined> {
  const porSub = await repo.buscarPorSub(sub);
  if (porSub.length > 1) {
    registrarError('Usuarios: varias filas con el mismo sub; revisar la tabla');
    return undefined;
  }
  if (porSub.length === 1) return porSub[0];

  const porEmail = await repo.buscarPorEmail(email);
  if (porEmail.length > 1) {
    registrarError('Usuarios: varias filas con el mismo email; revisar la tabla');
    return undefined;
  }
  const usuario = porEmail[0];
  if (!usuario || usuario.sub) return undefined;
  return usuario;
}

// ---------- Dependencias reales (una por instancia) ----------

let cliente: OAuth2Client | undefined;
const limiteCompartido = new LimitePeticiones();

export const verificarConGoogle: VerificadorToken = async (token, audiencia) => {
  cliente ??= new OAuth2Client();
  // verifyIdToken comprueba firma (claves públicas de Google, cacheadas), emisor y caducidad.
  const ticket = await cliente.verifyIdToken({ idToken: token, audience: audiencia });
  return ticket.getPayload() ?? {};
};

export function depsIdentidad(
  registrarError: (mensaje: string) => void,
  env: NodeJS.ProcessEnv = process.env,
): DepsIdentidad {
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    verificar: verificarConGoogle,
    usuarios: () => new RepositorioUsuarios(tablaClient('Usuarios', env), tablaClient('Auditoria', env)),
    limite: limiteCompartido,
    registrarError,
  };
}
