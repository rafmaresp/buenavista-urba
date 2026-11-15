/** Incidencias de farola (spec 006-reportar-incidencia-farola): modelo y validación de la petición. */

export const TIPO_FAROLA_FUNDIDA = 'farola-fundida';
export const ESTADO_INICIAL = 'Nuevo';
/** Única que no está abierta: la farola vuelve a admitir avisos. */
export const ESTADO_COMPLETADO = 'Completado';
export const MAX_COMENTARIO = 280;

/** Lo único que sale por la API: nunca el autor ni el comentario. */
export interface IncidenciaPublica {
  id: string;
  farola: string;
  estado: string;
  creada: string;
}

export interface PeticionAviso {
  farola: string;
  /** Recortado; vacío = sin comentario. */
  comentario: string;
}

const ID_FAROLA = /^F\d{2}$/;

/** Valida el cuerpo de POST /api/incidencias. Devuelve undefined si no es válido (los campos de más se ignoran). */
export function validarPeticion(cuerpo: unknown): PeticionAviso | undefined {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) return undefined;
  const { farola, comentario } = cuerpo as Record<string, unknown>;
  if (typeof farola !== 'string' || !ID_FAROLA.test(farola)) return undefined;
  if (comentario !== undefined && comentario !== null && typeof comentario !== 'string') return undefined;
  const texto = typeof comentario === 'string' ? comentario.trim() : '';
  // Longitud en caracteres (no en unidades UTF-16), como el contador de la web.
  if ([...texto].length > MAX_COMENTARIO) return undefined;
  return { farola, comentario: texto };
}

// ---------- Cambio de estado (spec 008-cambiar-estado-incidencia) ----------

/** Ciclo de estados (docs/producto.md sec. 4), en orden. Solo se avanza; Completado es final. */
export const ESTADOS = [ESTADO_INICIAL, 'Recibido', 'Profesional notificado', ESTADO_COMPLETADO] as const;
export type EstadoIncidencia = (typeof ESTADOS)[number];

export function esEstado(valor: unknown): valor is EstadoIncidencia {
  return typeof valor === 'string' && (ESTADOS as readonly string[]).includes(valor);
}

/** true si `destino` va después de `actual` (se pueden saltar estados; nunca hacia atrás ni al mismo). */
export function esPosterior(actual: string, destino: string): boolean {
  const desde = (ESTADOS as readonly string[]).indexOf(actual);
  const hasta = (ESTADOS as readonly string[]).indexOf(destino);
  return desde >= 0 && hasta > desde;
}

export interface PeticionCambioEstado {
  id: string;
  farola: string;
  estado: EstadoIncidencia;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida id (ruta) y cuerpo de PUT /api/incidencias/{id}. undefined si no es válido (campos de más se ignoran). */
export function validarCambio(id: string | undefined, cuerpo: unknown): PeticionCambioEstado | undefined {
  if (!id || !UUID.test(id)) return undefined;
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) return undefined;
  const { farola, estado } = cuerpo as Record<string, unknown>;
  if (typeof farola !== 'string' || !ID_FAROLA.test(farola)) return undefined;
  if (!esEstado(estado)) return undefined;
  return { id, farola, estado };
}
