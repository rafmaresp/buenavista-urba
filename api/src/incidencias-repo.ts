import { randomUUID } from 'node:crypto';
import { type ClienteAuditoria, auditar, entidadDeAuditoria } from './auditoria';
import { ESTADO_COMPLETADO, ESTADO_INICIAL, type IncidenciaPublica, TIPO_FAROLA_FUNDIDA } from './incidencias';

/** RowKey de la fila candado: existe mientras la farola (partición) tiene una incidencia abierta. */
export const CANDADO = 'abierta';

type EntidadIncidencia = {
  partitionKey: string;
  rowKey: string;
  tipo: string;
  estado: string;
  autor: string;
  creada: string;
  comentario: string;
};

type EntidadCandado = {
  partitionKey: string;
  rowKey: string;
  incidencia: string;
};

type Clave = { partitionKey: string; rowKey: string };

/** Lo que el repositorio necesita de la tabla Incidencias (el SAS de la app es `rad`). */
export interface ClienteTablaIncidencias {
  createEntity(entity: EntidadIncidencia | EntidadCandado): Promise<unknown>;
  deleteEntity(partitionKey: string, rowKey: string): Promise<unknown>;
  getEntity<T extends object>(partitionKey: string, rowKey: string, options?: { queryOptions?: { select?: string[] } }): Promise<T>;
  listEntities<T extends object>(options?: {
    queryOptions?: { filter?: string; select?: string[] };
  }): AsyncIterable<T & { partitionKey?: string; rowKey?: string }>;
}

export interface NuevaIncidencia {
  farola: string;
  /** Ya validado y recortado; vacío = sin comentario. */
  comentario: string;
  /** uid del usuario identificado. */
  autor: string;
}

/** Campos que se leen para responder: nunca autor ni comentario. */
const CAMPOS_PUBLICOS = ['PartitionKey', 'RowKey', 'estado', 'creada', 'incidencia'];

/**
 * Única puerta de escritura de Incidencias. Como RepositorioFarolas, la auditoría es un efecto de
 * cada alta: valida la entrada, escribe, audita y, si la auditoría falla, deshace y propaga el error.
 *
 * Duplicados (research.md sec. 1): en la partición de la farola, la fila candado `abierta` se
 * inserta de forma condicional (insertar falla con 409 si ya existe), así que dos avisos
 * simultáneos no pueden dejar dos incidencias abiertas. Abierta = referida por el candado: una fila
 * de incidencia sin candado (alta a medias) nunca se ve como abierta.
 */
export class RepositorioIncidencias {
  constructor(
    private readonly incidencias: ClienteTablaIncidencias,
    private readonly auditoria: ClienteAuditoria,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async crear(nueva: NuevaIncidencia): Promise<IncidenciaPublica> {
    const creada = this.ahora().toISOString();
    const incidencia: EntidadIncidencia = {
      partitionKey: nueva.farola,
      rowKey: randomUUID(),
      tipo: TIPO_FAROLA_FUNDIDA,
      estado: ESTADO_INICIAL,
      autor: nueva.autor,
      creada,
      comentario: nueva.comentario,
    };
    const candado: EntidadCandado = { partitionKey: nueva.farola, rowKey: CANDADO, incidencia: incidencia.rowKey };
    // Del comentario solo se audita si está y su longitud (constitución II): nunca el texto.
    const entrada = entidadDeAuditoria({
      actor: nueva.autor,
      accion: 'incidencia.alta',
      entidad: 'Incidencias',
      clave: `${nueva.farola}/${incidencia.rowKey}`,
      antes: null,
      despues: {
        farola: nueva.farola,
        estado: ESTADO_INICIAL,
        comentarioPresente: nueva.comentario.length > 0,
        comentarioLongitud: nueva.comentario.length,
      },
    });

    await this.incidencias.createEntity(incidencia);
    try {
      await this.incidencias.createEntity(candado);
    } catch (e) {
      await this.deshacer([incidencia], entrada.clave);
      if ((e as { statusCode?: number }).statusCode === 409) {
        const existente = await this.abiertaDe(nueva.farola);
        if (existente) throw new YaAbierta(existente);
      }
      throw e;
    }

    try {
      await auditar(this.auditoria, entrada);
    } catch (errorAuditoria) {
      // Primero el candado: si falla lo siguiente, la farola ya admite avisos y la fila suelta no se ve.
      await this.deshacer([candado, incidencia], entrada.clave);
      throw errorAuditoria;
    }

    return { id: incidencia.rowKey, farola: nueva.farola, estado: ESTADO_INICIAL, creada };
  }

  private async deshacer(filas: Clave[], clave: string): Promise<void> {
    try {
      for (const f of filas) await this.incidencias.deleteEntity(f.partitionKey, f.rowKey);
    } catch {
      throw new IncidenciaSinAuditar(clave);
    }
  }

  /** La incidencia abierta de una farola, si la hay (candado → fila). */
  async abiertaDe(farola: string): Promise<IncidenciaPublica | undefined> {
    try {
      const candado = await this.incidencias.getEntity<{ incidencia: string }>(farola, CANDADO);
      const fila = await this.incidencias.getEntity<{ estado: string; creada: string }>(farola, candado.incidencia, {
        queryOptions: { select: ['estado', 'creada'] },
      });
      return { id: candado.incidencia, farola, estado: fila.estado, creada: fila.creada };
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 404) return undefined;
      throw e;
    }
  }

  /** Todas las incidencias abiertas, ordenadas por farola. Ni se piden el autor ni el comentario. */
  async abiertas(): Promise<IncidenciaPublica[]> {
    const candados = new Map<string, string>();
    const filas = new Map<string, { estado?: string; creada?: string }>();
    const entidades = this.incidencias.listEntities<{ estado?: string; creada?: string; incidencia?: string }>({
      queryOptions: { select: CAMPOS_PUBLICOS },
    });
    for await (const e of entidades) {
      const farola = String(e.partitionKey);
      if (e.rowKey === CANDADO) candados.set(farola, String(e.incidencia));
      else filas.set(`${farola}/${String(e.rowKey)}`, e);
    }
    const abiertas: IncidenciaPublica[] = [];
    for (const [farola, id] of candados) {
      const fila = filas.get(`${farola}/${id}`);
      if (!fila?.estado || fila.estado === ESTADO_COMPLETADO) continue;
      abiertas.push({ id, farola, estado: fila.estado, creada: fila.creada ?? '' });
    }
    return abiertas.sort((a, b) => a.farola.localeCompare(b.farola));
  }
}

/** La farola ya tiene una incidencia abierta: no se crea otra. */
export class YaAbierta extends Error {
  constructor(readonly existente: IncidenciaPublica) {
    super(`${existente.farola} ya tiene una incidencia abierta`);
    this.name = 'YaAbierta';
  }
}

/** La auditoría (o el candado) falló y no se pudo deshacer el alta: hay que revisarlo a mano. */
export class IncidenciaSinAuditar extends Error {
  constructor(clave: string) {
    super(`La incidencia ${clave} se creó pero no se pudo auditar ni deshacer: revísala a mano`);
    this.name = 'IncidenciaSinAuditar';
  }
}
