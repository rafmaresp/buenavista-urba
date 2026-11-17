import { ID_FAROLA, type RespuestaHttp, validarReubicacion } from './farolas';
import { FarolaCambiada, FarolaNoEncontrada, type RepositorioFarolas, ReubicacionSinAuditar } from './farolas-repo';
import { type Cabeceras, type DepsIdentidad, identificar } from './identidad';

/** Dependencias de PUT /api/farolas/{id} (inyectables en las unitarias). */
export interface DepsFarolas {
  farolas: () => RepositorioFarolas;
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

/**
 * PUT /api/farolas/{id}: solo la directiva (constitución IV). Orden: identidad → rol → id y
 * cuerpo → repositorio. El cuerpo nunca se registra.
 */
export async function respuestaReubicar(
  id: string | undefined,
  cabeceras: Cabeceras,
  leerCuerpo: () => Promise<unknown>,
  identidad: DepsIdentidad,
  deps: DepsFarolas,
): Promise<RespuestaHttp> {
  const quien = await identificar(cabeceras, identidad);
  if (!quien.ok) return quien.respuesta;
  if (quien.usuario.rol !== 'directiva') return respuesta(403, { error: 'sin-acceso' });

  if (!id || !ID_FAROLA.test(id)) return respuesta(400, { error: 'peticion-no-valida' });
  let cuerpo: unknown;
  try {
    cuerpo = await leerCuerpo();
  } catch {
    return respuesta(400, { error: 'peticion-no-valida' });
  }
  const posicion = validarReubicacion(cuerpo);
  if (!posicion) return respuesta(400, { error: 'peticion-no-valida' });

  try {
    const farola = await deps.farolas().reubicar(id, posicion, quien.usuario.uid);
    return respuesta(200, { farola });
  } catch (e) {
    if (e instanceof FarolaNoEncontrada) return respuesta(404, { error: 'no-encontrada' });
    if (e instanceof FarolaCambiada) return respuesta(409, { error: 'farola-cambiada' });
    if (e instanceof ReubicacionSinAuditar) {
      deps.registrarError(`PUT /api/farolas/${id}: reubicada sin auditar ni restaurar; revisar a mano`);
    } else {
      deps.registrarError(`PUT /api/farolas/${id} falló: ${describir(e)}`);
    }
    return respuesta(503, { error: 'no-disponible' });
  }
}
