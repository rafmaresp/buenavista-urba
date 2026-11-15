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

// ---------- Cambio de estado (specs/007-cambiar-estado-incidencia, solo directiva) ----------

/** Ciclo de estados, en orden (docs/producto.md sec. 4). Lo valida la API; aquí solo se ofrece. */
export const ESTADOS = ['Nuevo', 'Recibido', 'Profesional notificado', 'Completado'] as const;
export type EstadoIncidencia = (typeof ESTADOS)[number];
export const ESTADO_COMPLETADO: EstadoIncidencia = 'Completado';

/** Estados a los que se puede pasar desde `estado`: solo hacia delante. */
export function estadosSiguientes(estado: string): EstadoIncidencia[] {
  const i = (ESTADOS as readonly string[]).indexOf(estado);
  return i < 0 ? [] : ESTADOS.slice(i + 1);
}

/** Por qué no se pudo cambiar: sin sesión o sin permiso, otro cambio ganó o ya no está abierta, o sin servicio. */
export type MotivoErrorCambio = 'sin-sesion' | 'ha-cambiado' | 'no-disponible';

export class ErrorCambio extends Error {
  constructor(
    readonly motivo: MotivoErrorCambio,
    /** Con `ha-cambiado`: la incidencia como está ahora, si la API la devolvió (si no, ya no está abierta). */
    readonly actual?: IncidenciaPublica,
  ) {
    super(`No se pudo cambiar el estado: ${motivo}`);
    this.name = 'ErrorCambio';
  }
}

/** PUT /api/incidencias/{id}. Devuelve la incidencia con el estado nuevo; cualquier otro caso lanza ErrorCambio. */
export async function cambiarEstado(
  llamar: LlamarFn,
  incidencia: IncidenciaPublica,
  estado: EstadoIncidencia,
): Promise<IncidenciaPublica> {
  let respuesta: Awaited<ReturnType<LlamarFn>>;
  try {
    respuesta = await llamar(`/api/incidencias/${encodeURIComponent(incidencia.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farola: incidencia.farola, estado }),
    });
  } catch {
    throw new ErrorCambio('no-disponible');
  }
  if (respuesta.status === 401 || respuesta.status === 403) throw new ErrorCambio('sin-sesion');
  const cuerpo = (await respuesta.json().catch(() => null)) as { incidencia?: unknown } | null;
  if (respuesta.status === 404) throw new ErrorCambio('ha-cambiado');
  if (respuesta.status === 409) {
    throw new ErrorCambio('ha-cambiado', esIncidencia(cuerpo?.incidencia) ? soloPublico(cuerpo.incidencia) : undefined);
  }
  if (respuesta.status !== 200 || !esIncidencia(cuerpo?.incidencia)) throw new ErrorCambio('no-disponible');
  return soloPublico(cuerpo.incidencia);
}
