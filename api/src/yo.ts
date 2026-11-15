import type { RespuestaHttp } from './farolas';
import { type Cabeceras, type DepsIdentidad, identificar } from './identidad';

/** GET /api/yo: el rol del usuario identificado (nada más: ni uid, ni email). */
export async function respuestaYo(cabeceras: Cabeceras, deps: DepsIdentidad): Promise<RespuestaHttp> {
  const resultado = await identificar(cabeceras, deps);
  if (!resultado.ok) return resultado.respuesta;
  return { status: 200, headers: { 'Cache-Control': 'no-store' }, jsonBody: { rol: resultado.usuario.rol } };
}
