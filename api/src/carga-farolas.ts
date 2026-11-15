import { odata } from '@azure/data-tables';
import type { ClienteAuditoria } from './auditoria';
import { conAuditoria } from './auditoria';
import { type EntidadFarola, type Farola, PARTICION_FAROLAS, entidadDeFarola } from './farolas';

export const ACTOR_CARGA = 'sistema:carga';

/** Lo mínimo que la carga necesita de la tabla Farolas: listar claves y crear (nunca actualizar). */
export interface ClienteCargaFarolas {
  listEntities<T extends object>(options?: {
    queryOptions?: { filter?: string; select?: string[] };
  }): AsyncIterable<T & { rowKey?: string }>;
  createEntity(entity: EntidadFarola): Promise<unknown>;
}

export interface ResultadoCarga {
  altas: string[];
  existentes: number;
}

/**
 * Siembra el catálogo como una migración de datos: da de alta solo las farolas que faltan, cada una
 * auditada antes con actor `sistema:carga`, y nunca toca una existente (su posición vigente puede
 * venir de una reubicación). `createEntity` falla si otra carga la creó a la vez: no sobrescribe.
 */
export async function cargarFarolas(
  clientes: { farolas: ClienteCargaFarolas; auditoria: ClienteAuditoria },
  semilla: Farola[],
): Promise<ResultadoCarga> {
  const existentes = new Set<string>();
  const entidades = clientes.farolas.listEntities<object>({
    queryOptions: { filter: odata`PartitionKey eq ${PARTICION_FAROLAS}`, select: ['RowKey'] },
  });
  for await (const e of entidades) existentes.add(String(e.rowKey));

  const altas: string[] = [];
  for (const farola of semilla) {
    if (existentes.has(farola.id)) continue;
    const entidad = entidadDeFarola(farola);
    await conAuditoria(
      clientes.auditoria,
      {
        actor: ACTOR_CARGA,
        accion: 'farola.alta',
        entidad: 'Farolas',
        clave: farola.id,
        antes: null,
        despues: { calle: entidad.calle, lat: entidad.lat, lon: entidad.lon, precision: entidad.precision },
      },
      () => clientes.farolas.createEntity(entidad),
    );
    altas.push(farola.id);
  }
  return { altas, existentes: existentes.size };
}
