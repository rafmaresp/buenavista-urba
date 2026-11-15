// Doble en memoria de la tabla Incidencias para las unitarias: insertar falla con 409 si ya existe y
// actualizar o borrar con un ETag desfasado falla con 412, como Table Storage.
import { vi } from 'vitest';
import type { ClienteTablaIncidencias } from '../incidencias-repo';

type Fila = Record<string, unknown> & { partitionKey: string; rowKey: string };

function error(statusCode: number) {
  // El mensaje imita un RestError con el SAS en la URL: nunca debe acabar en un log.
  return Object.assign(new Error('https://cuenta.table.core.windows.net/Incidencias?sig=secreto'), { name: 'RestError', statusCode });
}

export interface OpcionesTablaIncidencias {
  deshacerFalla?: boolean;
  lecturaFalla?: boolean;
  /** Falla la actualización número N (1 = la primera) con 500. */
  actualizarFallaEn?: number;
  /** Borrar el candado falla con 500. */
  borrarCandadoFalla?: boolean;
  /** Antes de actualizar, otra petición cambia la fila a este estado (simula una carrera). */
  carreraA?: string;
}

export function tablaIncidencias(opciones: OpcionesTablaIncidencias = {}) {
  const filas = new Map<string, Fila>();
  const etags = new Map<string, number>();
  const clave = (pk: string, rk: string) => `${pk}|${rk}`;
  const etagDe = (k: string) => `W/"${etags.get(k) ?? 0}"`;
  const tocar = (k: string) => etags.set(k, (etags.get(k) ?? 0) + 1);
  const orden: string[] = [];
  let actualizaciones = 0;
  const nombre = (rk: string) => (rk === 'abierta' ? 'candado' : 'incidencia');
  const cliente = {
    createEntity: vi.fn(async (e: Fila) => {
      orden.push(`crear ${nombre(e.rowKey)}`);
      const k = clave(e.partitionKey, e.rowKey);
      if (filas.has(k)) throw error(409);
      filas.set(k, { ...e });
      tocar(k);
    }),
    deleteEntity: vi.fn(async (pk: string, rk: string, o?: { etag?: string }) => {
      orden.push(`borrar ${nombre(rk)}`);
      if (opciones.deshacerFalla) throw error(500);
      if (opciones.borrarCandadoFalla && rk === 'abierta') throw error(500);
      const k = clave(pk, rk);
      if (!filas.has(k)) throw error(404);
      if (o?.etag && o.etag !== '*' && o.etag !== etagDe(k)) throw error(412);
      filas.delete(k);
    }),
    getEntity: vi.fn(async <T extends object>(pk: string, rk: string) => {
      const k = clave(pk, rk);
      const f = filas.get(k);
      if (!f) throw error(404);
      return { ...f, etag: etagDe(k) } as unknown as T & { etag?: string };
    }),
    updateEntity: vi.fn(async (e: { partitionKey: string; rowKey: string; estado: string }, _modo: 'Merge', o?: { etag?: string }) => {
      actualizaciones += 1;
      orden.push(`estado ${e.estado}`);
      const k = clave(e.partitionKey, e.rowKey);
      if (opciones.carreraA && actualizaciones === 1) {
        filas.set(k, { ...filas.get(k)!, estado: opciones.carreraA });
        tocar(k);
      }
      if (opciones.actualizarFallaEn === actualizaciones) throw error(500);
      if (!filas.has(k)) throw error(404);
      if (o?.etag && o.etag !== '*' && o.etag !== etagDe(k)) throw error(412);
      filas.set(k, { ...filas.get(k)!, estado: e.estado });
      tocar(k);
      return { etag: etagDe(k) };
    }),
    listEntities: vi.fn(<T extends object>(options?: { queryOptions?: { select?: string[] } }) => {
      const select = options?.queryOptions?.select;
      return (async function* () {
        if (opciones.lecturaFalla) throw error(500);
        for (const f of filas.values()) {
          const campos = Object.entries(f).filter(
            ([c]) => !select || c === 'partitionKey' || c === 'rowKey' || select.includes(c),
          );
          yield Object.fromEntries(campos) as unknown as T & { partitionKey: string; rowKey: string };
        }
      })();
    }),
  } satisfies ClienteTablaIncidencias;
  return { cliente, filas, orden };
}
