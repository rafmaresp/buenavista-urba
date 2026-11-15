import type { RespuestaHttp } from './farolas';
import { type Cabeceras, type DepsIdentidad, identificar } from './identidad';
import { validarCambio, validarPeticion } from './incidencias';
import { HaCambiado, NoEncontrada, type RepositorioIncidencias, TransicionNoValida, YaAbierta } from './incidencias-repo';

/** Dependencias de las Functions de incidencias (inyectables en las unitarias). */
export interface DepsIncidencias {
  incidencias: () => RepositorioIncidencias;
  /** true si la farola está en el catálogo (tabla Farolas). */
  farolaExiste: (id: string) => Promise<boolean>;
  registrarError: (mensaje: string) => void;
}

const NO_STORE = { 'Cache-Control': 'no-store' };

function respuesta(status: number, jsonBody: unknown): RespuestaHttp {
  return { status, headers: NO_STORE, jsonBody };
}

/** Solo el nombre y el código: el mensaje de un RestError puede llevar la URL con el SAS. */
function describir(e: unknown): string {
  const error = e as { name?: string; statusCode?: number };
  return `${error.name ?? 'Error'} ${error.statusCode ?? ''}`.trim();
}

/** GET /api/incidencias: anónimo; solo las abiertas, sin autor ni comentario. */
export async function respuestaListar(deps: DepsIncidencias): Promise<RespuestaHttp> {
  try {
    return respuesta(200, { incidencias: await deps.incidencias().abiertas() });
  } catch (e) {
    deps.registrarError(`GET /api/incidencias falló: ${describir(e)}`);
    return respuesta(500, { error: 'no-disponible' });
  }
}

/**
 * POST /api/incidencias: identifica en cada petición (constitución IV), valida, comprueba que la
 * farola existe y crea la incidencia. El cuerpo nunca se registra (lleva el comentario).
 */
export async function respuestaCrear(
  cabeceras: Cabeceras,
  leerCuerpo: () => Promise<unknown>,
  identidad: DepsIdentidad,
  deps: DepsIncidencias,
): Promise<RespuestaHttp> {
  const quien = await identificar(cabeceras, identidad);
  if (!quien.ok) return quien.respuesta;

  let cuerpo: unknown;
  try {
    cuerpo = await leerCuerpo();
  } catch {
    return respuesta(400, { error: 'peticion-no-valida' });
  }
  const peticion = validarPeticion(cuerpo);
  if (!peticion) return respuesta(400, { error: 'peticion-no-valida' });

  try {
    if (!(await deps.farolaExiste(peticion.farola))) return respuesta(400, { error: 'peticion-no-valida' });
    const incidencia = await deps.incidencias().crear({ ...peticion, autor: quien.usuario.uid });
    return respuesta(201, { incidencia });
  } catch (e) {
    if (e instanceof YaAbierta) return respuesta(409, { error: 'ya-abierta', incidencia: e.existente });
    deps.registrarError(`POST /api/incidencias falló: ${describir(e)}`);
    return respuesta(503, { error: 'no-disponible' });
  }
}

/**
 * PUT /api/incidencias/{id} (spec 007): solo la directiva cambia el estado. Identifica en cada
 * petición y comprueba el rol aquí, en el servidor (constitución IV); un comunero recibe el mismo
 * 403 genérico que quien no está en la lista. El cuerpo nunca se registra.
 */
export async function respuestaCambiarEstado(
  cabeceras: Cabeceras,
  id: string | undefined,
  leerCuerpo: () => Promise<unknown>,
  identidad: DepsIdentidad,
  deps: DepsIncidencias,
): Promise<RespuestaHttp> {
  const quien = await identificar(cabeceras, identidad);
  if (!quien.ok) return quien.respuesta;
  if (quien.usuario.rol !== 'directiva') return respuesta(403, { error: 'sin-acceso' });

  let cuerpo: unknown;
  try {
    cuerpo = await leerCuerpo();
  } catch {
    return respuesta(400, { error: 'peticion-no-valida' });
  }
  const peticion = validarCambio(id, cuerpo);
  if (!peticion) return respuesta(400, { error: 'peticion-no-valida' });

  try {
    const incidencia = await deps.incidencias().cambiarEstado({ ...peticion, actor: quien.usuario.uid });
    return respuesta(200, { incidencia });
  } catch (e) {
    if (e instanceof NoEncontrada) return respuesta(404, { error: 'no-encontrada' });
    if (e instanceof TransicionNoValida) return respuesta(409, { error: 'transicion-no-valida', incidencia: e.actual });
    if (e instanceof HaCambiado) return respuesta(409, { error: 'ha-cambiado', incidencia: e.actual });
    deps.registrarError(`PUT /api/incidencias falló: ${describir(e)}`);
    return respuesta(503, { error: 'no-disponible' });
  }
}
