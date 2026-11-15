/** Cliente de GET /api/farolas (contrato en specs/003-catalogo-farolas/contracts/get-farolas.md). */

export interface FarolaPublica {
  id: string;
  calle: string;
  lat: number;
  lon: number;
}

export type FetchFn = (url: string) => Promise<Pick<Response, 'ok' | 'json'>>;

export class ErrorCargaFarolas extends Error {
  constructor(motivo: string) {
    super(`No se pudieron cargar las farolas: ${motivo}`);
    this.name = 'ErrorCargaFarolas';
  }
}

function esFarola(valor: unknown): valor is FarolaPublica {
  if (typeof valor !== 'object' || valor === null) return false;
  const f = valor as Record<string, unknown>;
  return (
    typeof f['id'] === 'string' &&
    /^F\d{2}$/.test(f['id']) &&
    typeof f['calle'] === 'string' &&
    f['calle'].trim() !== '' &&
    typeof f['lat'] === 'number' &&
    Number.isFinite(f['lat']) &&
    typeof f['lon'] === 'number' &&
    Number.isFinite(f['lon'])
  );
}

/**
 * Pide el catálogo y valida su forma. Cualquier fallo (red, estado, cuerpo) lanza
 * ErrorCargaFarolas: un catálogo malformado es un error visible, no un mapa a medias.
 */
export async function cargarFarolas(fetchFn: FetchFn = (url) => fetch(url)): Promise<FarolaPublica[]> {
  let respuesta: Awaited<ReturnType<FetchFn>>;
  try {
    respuesta = await fetchFn('/api/farolas');
  } catch {
    throw new ErrorCargaFarolas('sin conexión');
  }
  if (!respuesta.ok) throw new ErrorCargaFarolas('respuesta con error');

  let cuerpo: unknown;
  try {
    cuerpo = await respuesta.json();
  } catch {
    throw new ErrorCargaFarolas('respuesta no es JSON');
  }
  const farolas = (cuerpo as { farolas?: unknown } | null)?.farolas;
  if (!Array.isArray(farolas)) throw new ErrorCargaFarolas('respuesta sin lista de farolas');
  if (!farolas.every(esFarola)) throw new ErrorCargaFarolas('farola con datos no válidos');
  return farolas.map(({ id, calle, lat, lon }) => ({ id, calle, lat, lon }));
}
