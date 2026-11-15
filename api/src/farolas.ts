/** Catálogo de farolas: semilla (CSV), entidad de la tabla Farolas y respuesta de GET /api/farolas. */
import { odata } from '@azure/data-tables';

export const PARTICION_FAROLAS = 'farola';
export const TOTAL_FAROLAS = 70;

export type Precision = 'verificada' | 'estimada';

export interface Farola {
  id: string;
  calle: string;
  lat: number;
  lon: number;
  /** Interna: no sale por la API pública (solo la directiva, en el cambio 8). */
  precision: Precision;
}

export interface EntidadFarola {
  partitionKey: string;
  rowKey: string;
  calle: string;
  lat: number;
  lon: number;
  precision: Precision;
}

/** Lo que devuelve la API pública: nunca la precisión. */
export interface FarolaPublica {
  id: string;
  calle: string;
  lat: number;
  lon: number;
}

const CABECERA = 'farola,calle,lat,lon,posicion';
const LAT = { min: 37.3, max: 37.33 };
const LON = { min: -5.98, max: -5.95 };

export class SemillaInvalida extends Error {
  constructor(linea: number, motivo: string) {
    super(`data/farolas_buenavista.csv, línea ${linea}: ${motivo}`);
    this.name = 'SemillaInvalida';
  }
}

export function idDeFarola(numero: number): string {
  return `F${String(numero).padStart(2, '0')}`;
}

function numeroEnRango(texto: string, rango: { min: number; max: number }): number | undefined {
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return undefined;
  const valor = Number(texto);
  return valor >= rango.min && valor <= rango.max ? valor : undefined;
}

/**
 * Lee las farolas de la semilla, hasta la primera línea en blanco (después vienen los tramos).
 * Valida todo antes de devolver nada: si una fila falla, la carga no escribe.
 */
export function parsearSemilla(texto: string): Farola[] {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/);
  if (lineas[0]?.trim() !== CABECERA) throw new SemillaInvalida(1, `la cabecera debe ser "${CABECERA}"`);

  const farolas: Farola[] = [];
  const vistos = new Set<string>();
  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i]!.trim();
    if (linea === '') break;
    const n = i + 1;
    if (linea.includes('"')) throw new SemillaInvalida(n, 'no se admiten comillas');
    const campos = linea.split(',');
    if (campos.length !== 5) throw new SemillaInvalida(n, 'se esperaban 5 campos');
    const [numero, calle, lat, lon, posicion] = campos.map((c) => c.trim()) as [string, string, string, string, string];

    if (!/^\d{1,2}$/.test(numero) || Number(numero) < 1 || Number(numero) > TOTAL_FAROLAS) {
      throw new SemillaInvalida(n, `farola "${numero}" fuera de 1–${TOTAL_FAROLAS}`);
    }
    const id = idDeFarola(Number(numero));
    if (vistos.has(id)) throw new SemillaInvalida(n, `${id} repetida`);
    if (!calle) throw new SemillaInvalida(n, `${id} sin calle`);
    const latitud = numeroEnRango(lat, LAT);
    if (latitud === undefined) throw new SemillaInvalida(n, `${id}: latitud "${lat}" fuera de la urbanización`);
    const longitud = numeroEnRango(lon, LON);
    if (longitud === undefined) throw new SemillaInvalida(n, `${id}: longitud "${lon}" fuera de la urbanización`);
    if (posicion !== 'verificada' && posicion !== 'estimada') {
      throw new SemillaInvalida(n, `${id}: posicion "${posicion}" no es verificada ni estimada`);
    }

    vistos.add(id);
    farolas.push({ id, calle, lat: latitud, lon: longitud, precision: posicion });
  }

  if (farolas.length !== TOTAL_FAROLAS) {
    const faltan = Array.from({ length: TOTAL_FAROLAS }, (_, k) => idDeFarola(k + 1)).filter((id) => !vistos.has(id));
    throw new SemillaInvalida(lineas.length, `hay ${farolas.length} farolas, faltan ${faltan.join(', ')}`);
  }
  return farolas;
}

export function entidadDeFarola(farola: Farola): EntidadFarola {
  return {
    partitionKey: PARTICION_FAROLAS,
    rowKey: farola.id,
    calle: farola.calle,
    lat: farola.lat,
    lon: farola.lon,
    precision: farola.precision,
  };
}

/** Lo mínimo que hace falta de un TableClient para leer el catálogo. */
export interface ClienteLecturaFarolas {
  listEntities<T extends object>(options?: {
    queryOptions?: { filter?: string; select?: string[] };
  }): AsyncIterable<T & { rowKey?: string }>;
}

/** Lee el catálogo con solo los campos públicos (la precisión ni se pide a la tabla). */
export async function listarFarolas(cliente: ClienteLecturaFarolas): Promise<FarolaPublica[]> {
  const farolas: FarolaPublica[] = [];
  const entidades = cliente.listEntities<{ calle: string; lat: number; lon: number }>({
    queryOptions: { filter: odata`PartitionKey eq ${PARTICION_FAROLAS}`, select: ['RowKey', 'calle', 'lat', 'lon'] },
  });
  for await (const e of entidades) {
    farolas.push({ id: String(e.rowKey), calle: e.calle, lat: e.lat, lon: e.lon });
  }
  return farolas.sort((a, b) => a.id.localeCompare(b.id));
}

export interface RespuestaHttp {
  status: number;
  headers: Record<string, string>;
  jsonBody: unknown;
}

/** Respuesta de GET /api/farolas: cacheable 5 min; un error no se cachea ni da detalles. */
export async function respuestaFarolas(
  obtenerCliente: () => ClienteLecturaFarolas,
  registrarError: (mensaje: string) => void = () => {},
): Promise<RespuestaHttp> {
  try {
    const farolas = await listarFarolas(obtenerCliente());
    return { status: 200, headers: { 'Cache-Control': 'public, max-age=300' }, jsonBody: { farolas } };
  } catch (e) {
    // Solo el nombre y el código: el mensaje de un RestError puede llevar la URL con el SAS.
    const error = e as { name?: string; statusCode?: number };
    registrarError(`GET /api/farolas falló: ${error.name ?? 'Error'} ${error.statusCode ?? ''}`.trim());
    return {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
      jsonBody: { error: 'No se pudo cargar el catálogo de farolas' },
    };
  }
}
