import { odata } from '@azure/data-tables';
import { type ClienteAuditoria, auditar, entidadDeAuditoria } from './auditoria';
import { type EntidadFarola, type Farola, PARTICION_FAROLAS, entidadDeFarola } from './farolas';

/** Lo que el repositorio necesita de la tabla Farolas. */
export interface ClienteTablaFarolas {
  listEntities<T extends object>(options?: {
    queryOptions?: { filter?: string; select?: string[] };
  }): AsyncIterable<T & { rowKey?: string }>;
  createEntity(entity: EntidadFarola): Promise<unknown>;
  deleteEntity(partitionKey: string, rowKey: string): Promise<unknown>;
}

/**
 * Única puerta de escritura de la tabla Farolas. La auditoría es un efecto de cada operación:
 * quien llama solo dice qué hacer y quién lo hace (actor), nunca llama a auditar().
 *
 * Table Storage no tiene transacciones entre tablas, así que cada escritura sigue este orden:
 * 1. valida la entrada de auditoría (si tiene datos prohibidos o un actor inválido, no se escribe nada);
 * 2. escribe el dato;
 * 3. añade la entrada de auditoría;
 * 4. si el paso 3 falla, deshace el paso 2 y propaga el error.
 */
export class RepositorioFarolas {
  constructor(
    private readonly farolas: ClienteTablaFarolas,
    private readonly auditoria: ClienteAuditoria,
  ) {}

  /** Ids de las farolas que ya están en el catálogo. */
  async ids(): Promise<Set<string>> {
    const ids = new Set<string>();
    const entidades = this.farolas.listEntities<object>({
      queryOptions: { filter: odata`PartitionKey eq ${PARTICION_FAROLAS}`, select: ['RowKey'] },
    });
    for await (const e of entidades) ids.add(String(e.rowKey));
    return ids;
  }

  /** Da de alta una farola (falla si ya existe: nunca sobrescribe) y lo audita como `farola.alta`. */
  async crear(farola: Farola, actor: string): Promise<void> {
    const entidad = entidadDeFarola(farola);
    const entrada = entidadDeAuditoria({
      actor,
      accion: 'farola.alta',
      entidad: 'Farolas',
      clave: farola.id,
      antes: null,
      despues: { calle: entidad.calle, lat: entidad.lat, lon: entidad.lon, precision: entidad.precision },
    });

    await this.farolas.createEntity(entidad);
    try {
      await auditar(this.auditoria, entrada);
    } catch (errorAuditoria) {
      // Sin auditoría no queda el cambio: se deshace el alta. Si deshacer también falla, se avisa
      // con un error propio para que nadie lo confunda con un alta auditada.
      try {
        await this.farolas.deleteEntity(entidad.partitionKey, entidad.rowKey);
      } catch {
        throw new AltaSinAuditar(farola.id);
      }
      throw errorAuditoria;
    }
  }
}

/** La auditoría falló y no se pudo deshacer el alta: hay que revisarlo a mano. */
export class AltaSinAuditar extends Error {
  constructor(id: string) {
    super(`${id} se dio de alta pero no se pudo auditar ni deshacer: revísala a mano`);
    this.name = 'AltaSinAuditar';
  }
}
