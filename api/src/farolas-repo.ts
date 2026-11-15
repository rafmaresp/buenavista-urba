import { odata } from '@azure/data-tables';
import { type ClienteAuditoria, auditar, entidadDeAuditoria } from './auditoria';
import {
  type EntidadFarola,
  type Farola,
  type FarolaPublica,
  PARTICION_FAROLAS,
  type Posicion,
  type Precision,
  entidadDeFarola,
} from './farolas';

/** Campos que cambia una reubicación (y los que se restauran si la auditoría falla). */
interface CambioPosicion {
  partitionKey: string;
  rowKey: string;
  lat: number;
  lon: number;
  precision: Precision;
}

/** Lo que el repositorio necesita de la tabla Farolas. */
export interface ClienteTablaFarolas {
  listEntities<T extends object>(options?: {
    queryOptions?: { filter?: string; select?: string[] };
  }): AsyncIterable<T & { rowKey?: string }>;
  createEntity(entity: EntidadFarola): Promise<unknown>;
  deleteEntity(partitionKey: string, rowKey: string): Promise<unknown>;
  getEntity<T extends object>(partitionKey: string, rowKey: string): Promise<T & { etag: string }>;
  updateEntity(entity: CambioPosicion, mode: 'Merge', options: { etag: string }): Promise<{ etag?: string }>;
}

function statusCode(e: unknown): number | undefined {
  return (e as { statusCode?: number }).statusCode;
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

  /**
   * Mueve una farola existente (nunca la crea) y fija su precisión a `verificada`; lo audita como
   * `farola.reubicacion` con la posición anterior y la nueva. La escritura va condicionada al ETag
   * leído: si otro la cambió entretanto, FarolaCambiada y no se pisa nada.
   */
  async reubicar(id: string, posicion: Posicion, actor: string): Promise<FarolaPublica> {
    let actual: { calle: string; lat: number; lon: number; precision: Precision; etag: string };
    try {
      actual = await this.farolas.getEntity(PARTICION_FAROLAS, id);
    } catch (e) {
      if (statusCode(e) === 404) throw new FarolaNoEncontrada(id);
      throw e;
    }

    const antes: CambioPosicion = { partitionKey: PARTICION_FAROLAS, rowKey: id, lat: actual.lat, lon: actual.lon, precision: actual.precision };
    const despues: CambioPosicion = { partitionKey: PARTICION_FAROLAS, rowKey: id, lat: posicion.lat, lon: posicion.lon, precision: 'verificada' };
    const entrada = entidadDeAuditoria({
      actor,
      accion: 'farola.reubicacion',
      entidad: 'Farolas',
      clave: id,
      antes: { lat: antes.lat, lon: antes.lon, precision: antes.precision },
      despues: { lat: despues.lat, lon: despues.lon, precision: despues.precision },
    });

    let escrita: { etag?: string };
    try {
      escrita = await this.farolas.updateEntity(despues, 'Merge', { etag: actual.etag });
    } catch (e) {
      if (statusCode(e) === 412) throw new FarolaCambiada(id);
      throw e;
    }

    try {
      await auditar(this.auditoria, entrada);
    } catch (errorAuditoria) {
      // Se restaura lo anterior condicionado al ETag de nuestra escritura: si alguien escribió
      // después, no se pisa su cambio y queda para revisar a mano.
      try {
        if (!escrita.etag) throw new Error('sin ETag');
        await this.farolas.updateEntity(antes, 'Merge', { etag: escrita.etag });
      } catch {
        throw new ReubicacionSinAuditar(id);
      }
      throw errorAuditoria;
    }

    return { id, calle: actual.calle, lat: despues.lat, lon: despues.lon };
  }
}

/** La auditoría falló y no se pudo deshacer el alta: hay que revisarlo a mano. */
export class AltaSinAuditar extends Error {
  constructor(id: string) {
    super(`${id} se dio de alta pero no se pudo auditar ni deshacer: revísala a mano`);
    this.name = 'AltaSinAuditar';
  }
}

/** La auditoría falló y no se pudo restaurar la posición anterior: hay que revisarlo a mano. */
export class ReubicacionSinAuditar extends Error {
  constructor(id: string) {
    super(`${id} se reubicó pero no se pudo auditar ni restaurar: revísala a mano`);
    this.name = 'ReubicacionSinAuditar';
  }
}

export class FarolaNoEncontrada extends Error {
  constructor(id: string) {
    super(`${id} no está en el catálogo`);
    this.name = 'FarolaNoEncontrada';
  }
}

/** Otra escritura cambió la farola desde que se leyó (412 por el ETag). */
export class FarolaCambiada extends Error {
  constructor(id: string) {
    super(`${id} cambió mientras se reubicaba`);
    this.name = 'FarolaCambiada';
  }
}
