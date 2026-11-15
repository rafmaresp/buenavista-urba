import * as L from 'leaflet';

/** Centro de Buenavista I (Dos Hermanas) y zoom inicial, los del prototipo. */
export const CENTRO: L.LatLngTuple = [37.3165, -5.9606];
export const ZOOM_INICIAL = 17;
/** Desde este zoom se ven los códigos de las farolas (a 17 se solapan). */
export const ZOOM_ETIQUETAS = 18;

const OPCIONES_TESELAS = { maxZoom: 20, maxNativeZoom: 19 };

export const URL_PNOA =
  'https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&VERSION=1.0.0' +
  '&Layer=OI.OrthoimageCoverage&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible' +
  '&TileMatrix={z}&TileRow={y}&TileCol={x}';
export const URL_OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Capas base: la primera (Ortofoto PNOA) es la de defecto. */
export function crearCapasBase(): Record<string, L.TileLayer> {
  return {
    Ortofoto: L.tileLayer(URL_PNOA, { ...OPCIONES_TESELAS, attribution: 'PNOA © IGN' }),
    Callejero: L.tileLayer(URL_OSM, { ...OPCIONES_TESELAS, attribution: '© OpenStreetMap' }),
  };
}
