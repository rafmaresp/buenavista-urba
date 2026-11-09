import { NuevaIncidencia, TIPOS, Tipo } from './modelos';

// Caja que envuelve Buenavista I con margen; fuera de ella se rechaza.
const LAT_MIN = 37.305, LAT_MAX = 37.33, LON_MIN = -5.975, LON_MAX = -5.945;
export const MAX_DESCRIPCION = 500, MAX_CONTACTO = 100, MAX_CALLE = 80;

export interface IncidenciaValida {
  tipo: Tipo;
  farolaId?: string;
  calle?: string;
  lat: number;
  lon: number;
  descripcion?: string;
  contacto?: string;
}

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Devuelve la incidencia saneada o un mensaje de error. */
export function validar(n: NuevaIncidencia): IncidenciaValida | string {
  if (typeof n.tipo !== 'string' || !(TIPOS as readonly string[]).includes(n.tipo)) return 'Tipo no válido';
  const tipo = n.tipo as Tipo;
  if (typeof n.lat !== 'number' || typeof n.lon !== 'number' ||
      n.lat < LAT_MIN || n.lat > LAT_MAX || n.lon < LON_MIN || n.lon > LON_MAX) {
    return 'La ubicación está fuera de la urbanización';
  }
  const farolaId = tipo === 'farola' ? texto(n.farolaId) : undefined;
  if (tipo === 'farola' && !farolaId) return 'Indica la farola';
  if (farolaId && !/^F\d{2}$/.test(farolaId)) return 'Farola no válida';
  const descripcion = texto(n.descripcion), contacto = texto(n.contacto), calle = texto(n.calle);
  if (descripcion && descripcion.length > MAX_DESCRIPCION) return `La descripción supera ${MAX_DESCRIPCION} caracteres`;
  if (contacto && contacto.length > MAX_CONTACTO) return `El contacto supera ${MAX_CONTACTO} caracteres`;
  if (calle && calle.length > MAX_CALLE) return 'Calle no válida';
  return {
    tipo, farolaId, calle, descripcion, contacto,
    lat: Math.round(n.lat * 1e7) / 1e7,
    lon: Math.round(n.lon * 1e7) / 1e7,
  };
}
