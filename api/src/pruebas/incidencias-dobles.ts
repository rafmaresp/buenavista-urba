// Doble en memoria de la tabla Incidencias para las unitarias: insertar falla con 409 si ya existe.
import { vi } from 'vitest';
import type { ClienteTablaIncidencias } from '../incidencias-repo';

type Fila = Record<string, unknown> & { partitionKey: string; rowKey: string };

function error(statusCode: number) {
  // El mensaje imita un RestError con el SAS en la URL: nunca debe acabar en un log.
  return Object.assign(new Error('https://cuenta.table.core.windows.net/Incidencias?sig=secreto'), { name: 'RestError', statusCode });
}

export function tablaIncidencias(opciones: { deshacerFalla?: boolean; lecturaFalla?: boolean } = {}) {
  const filas = new Map<string, Fila>();
  const clave = (pk: string, rk: string) => `${pk}|${rk}`;
  const orden: string[] = [];
  const cliente = {
    createEntity: vi.fn(async (e: Fila) => {
      orden.push(`crear ${e.rowKey === 'abierta' ? 'candado' : 'incidencia'}`);
      const k = clave(e.partitionKey, e.rowKey);
      if (filas.has(k)) throw error(409);
      filas.set(k, { ...e });
    }),
    deleteEntity: vi.fn(async (pk: string, rk: string) => {
      orden.push(`borrar ${rk === 'abierta' ? 'candado' : 'incidencia'}`);
      if (opciones.deshacerFalla) throw error(500);
      if (!filas.delete(clave(pk, rk))) throw error(404);
    }),
    getEntity: vi.fn(async <T extends object>(pk: string, rk: string) => {
      const f = filas.get(clave(pk, rk));
      if (!f) throw error(404);
      return { ...f } as unknown as T;
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
