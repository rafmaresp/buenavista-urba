import * as L from 'leaflet';
import { Farola, Incidencia, Tramo, abierta } from './modelos';

/** Distancia máxima (m) para considerar que un toque cae en una calle. */
export const RADIO_CALLE = 30;
/** Distancia (m) por debajo de la cual un bache/fuga del mismo tipo se trata como posible duplicado. */
export const RADIO_DUPLICADO = 20;

export function tramoMasCercano(map: L.Map, tramos: Tramo[], ll: L.LatLng) {
  const p = map.latLngToLayerPoint(ll);
  let mejor: { calle: string; d: number } | null = null;
  for (const t of tramos) {
    const pts = t.pts.map((q) => map.latLngToLayerPoint(q));
    for (let k = 0; k < pts.length - 1; k++) {
      const c = L.LineUtil.closestPointOnSegment(p, pts[k], pts[k + 1]);
      const d = map.distance(ll, map.layerPointToLatLng(c));
      if (!mejor || d < mejor.d) mejor = { calle: t.calle, d };
    }
  }
  return mejor;
}

export function farolaMasCercana(map: L.Map, farolas: Farola[], lat: number, lon: number) {
  let mejor: { f: Farola; d: number } | null = null;
  for (const f of farolas) {
    const d = map.distance([lat, lon], [f.lat, f.lon]);
    if (!mejor || d < mejor.d) mejor = { f, d };
  }
  return mejor;
}

/** Busca una incidencia abierta que probablemente sea la misma que el borrador. */
export function posibleDuplicado(
  map: L.Map, incidencias: Incidencia[], tipo: string, farolaId: string | null, lat: number, lon: number,
): Incidencia | null {
  if (tipo === 'farola') return incidencias.find((i) => abierta(i) && i.farolaId === farolaId) ?? null;
  return (
    incidencias
      .filter((i) => abierta(i) && !i.farolaId && i.tipo === tipo)
      .map((i) => ({ i, d: map.distance([i.lat, i.lon], [lat, lon]) }))
      .filter((x) => x.d <= RADIO_DUPLICADO)
      .sort((a, b) => a.d - b.d)[0]?.i ?? null
  );
}
