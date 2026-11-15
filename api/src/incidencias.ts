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
