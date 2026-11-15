/** Cliente de /api/incidencias (contrato en specs/006-reportar-incidencia-farola/contracts/api.md). */

export interface IncidenciaPublica {
  id: string;
  farola: string;
  estado: string;
  creada: string;
}

export const MAX_COMENTARIO = 280;

export type FetchFn = (url: string) => Promise<Pick<Response, 'ok' | 'json'>>;
/** fetch con el token de la sesión (Sesion.llamar). */
export type LlamarFn = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export class ErrorIncidencias extends Error {
  constructor(motivo: string) {
    super(`No se pudieron cargar las incidencias: ${motivo}`);
    this.name = 'ErrorIncidencias';
  }
}

/** Por qué no se pudo enviar un aviso: sin sesión válida, rechazado por la API o sin servicio. */
export type MotivoErrorAviso = 'sin-sesion' | 'no-valido' | 'no-disponible';

export class ErrorAviso extends Error {
  constructor(readonly motivo: MotivoErrorAviso) {
    super(`No se pudo enviar el aviso: ${motivo}`);
    this.name = 'ErrorAviso';
  }
}

export function esIncidencia(valor: unknown): valor is IncidenciaPublica {
  if (typeof valor !== 'object' || valor === null) return false;
  const i = valor as Record<string, unknown>;
  return (
    typeof i['id'] === 'string' &&
    typeof i['farola'] === 'string' &&
    /^F\d{2}$/.test(i['farola']) &&
    typeof i['estado'] === 'string' &&
    i['estado'] !== '' &&
    typeof i['creada'] === 'string' &&
    !Number.isNaN(Date.parse(i['creada']))
  );
}

function soloPublico({ id, farola, estado, creada }: IncidenciaPublica): IncidenciaPublica {
  return { id, farola, estado, creada };
}

/** GET /api/incidencias (anónimo): las abiertas. Cualquier fallo lanza ErrorIncidencias. */
export async function cargarIncidencias(fetchFn: FetchFn = (url) => fetch(url)): Promise<IncidenciaPublica[]> {
  let respuesta: Awaited<ReturnType<FetchFn>>;
  try {
    respuesta = await fetchFn('/api/incidencias');
  } catch {
    throw new ErrorIncidencias('sin conexión');
  }
  if (!respuesta.ok) throw new ErrorIncidencias('respuesta con error');
  const cuerpo = (await respuesta.json().catch(() => null)) as { incidencias?: unknown } | null;
  const incidencias = cuerpo?.incidencias;
  if (!Array.isArray(incidencias) || !incidencias.every(esIncidencia)) throw new ErrorIncidencias('respuesta no válida');
  return incidencias.map(soloPublico);
}

/**
 * POST /api/incidencias. Devuelve la incidencia abierta de la farola: la creada o, si ya había
 * una (409), la existente. Cualquier otro caso lanza ErrorAviso.
 */
export async function reportarIncidencia(llamar: LlamarFn, farola: string, comentario: string): Promise<IncidenciaPublica> {
  let respuesta: Awaited<ReturnType<LlamarFn>>;
  try {
    respuesta = await llamar('/api/incidencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comentario.trim() ? { farola, comentario: comentario.trim() } : { farola }),
    });
  } catch {
    throw new ErrorAviso('no-disponible');
  }
  if (respuesta.status === 401 || respuesta.status === 403) throw new ErrorAviso('sin-sesion');
  if (respuesta.status === 400) throw new ErrorAviso('no-valido');
  if (respuesta.status !== 201 && respuesta.status !== 409) throw new ErrorAviso('no-disponible');
  const cuerpo = (await respuesta.json().catch(() => null)) as { incidencia?: unknown } | null;
  if (!esIncidencia(cuerpo?.incidencia)) throw new ErrorAviso('no-disponible');
  return soloPublico(cuerpo.incidencia);
}
