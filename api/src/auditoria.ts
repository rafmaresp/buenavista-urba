import { randomUUID } from 'node:crypto';

/** Lo mínimo que `auditar()` necesita de un TableClient (facilita las unitarias). */
export interface ClienteAuditoria {
  createEntity(entity: EntidadAuditoria): Promise<unknown>;
}

export type Estado = Record<string, unknown> | null;

export interface EntradaAuditoria {
  /** uid opaco (UUID), `sistema:<nombre>` o `dev:<alias>`. Nunca email ni `sub`. */
  actor: string;
  /** `<entidad>.<verbo>`, p. ej. `farola.alta`. */
  accion: string;
  /** Tabla afectada, p. ej. `Farolas`. */
  entidad: string;
  /** Clave de la entidad afectada, p. ej. `F07`. */
  clave: string;
  antes: Estado;
  despues: Estado;
}

export interface EntidadAuditoria {
  partitionKey: string;
  rowKey: string;
  cuando: string;
  actor: string;
  accion: string;
  entidad: string;
  clave: string;
  antes: string;
  despues: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTOR_NOMBRADO = /^(sistema|dev):[a-z][a-z0-9-]*$/;
const ACCION = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** Claves con datos personales o texto libre: prohibidas en antes/despues (constitución II, RGPD sec. 2). */
const CLAVES_PROHIBIDAS = new Set(['email', 'correo', 'sub', 'nombre', 'name', 'comentario']);

export class AuditoriaInvalida extends Error {
  constructor(motivo: string) {
    super(`Entrada de auditoría rechazada: ${motivo}`);
    this.name = 'AuditoriaInvalida';
  }
}

export function actorValido(actor: string): boolean {
  return UUID.test(actor) || ACTOR_NOMBRADO.test(actor);
}

function comprobarEstado(valor: unknown, ruta: string): void {
  if (typeof valor === 'string') {
    if (EMAIL.test(valor)) throw new AuditoriaInvalida(`${ruta} tiene forma de email`);
    return;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => comprobarEstado(v, `${ruta}[${i}]`));
    return;
  }
  if (valor !== null && typeof valor === 'object') {
    for (const [clave, v] of Object.entries(valor)) {
      if (CLAVES_PROHIBIDAS.has(clave.toLowerCase())) {
        throw new AuditoriaInvalida(`campo prohibido ${ruta}.${clave}`);
      }
      comprobarEstado(v, `${ruta}.${clave}`);
    }
  }
}

/** Valida la entrada y construye la entidad de la tabla Auditoria (PartitionKey = mes UTC AAAA-MM). */
export function entidadDeAuditoria(entrada: EntradaAuditoria, ahora: Date = new Date()): EntidadAuditoria {
  if (!actorValido(entrada.actor)) throw new AuditoriaInvalida('actor no válido');
  if (!ACCION.test(entrada.accion)) throw new AuditoriaInvalida('acción no válida');
  if (!/^[A-Z][A-Za-z]+$/.test(entrada.entidad)) throw new AuditoriaInvalida('entidad no válida');
  if (!entrada.clave) throw new AuditoriaInvalida('falta la clave');
  comprobarEstado(entrada.antes, 'antes');
  comprobarEstado(entrada.despues, 'despues');
  if (entrada.antes === null && entrada.despues === null) throw new AuditoriaInvalida('sin antes ni después');

  const cuando = ahora.toISOString();
  return {
    partitionKey: cuando.slice(0, 7),
    rowKey: `${cuando}_${randomUUID()}`,
    cuando,
    actor: entrada.actor,
    accion: entrada.accion,
    entidad: entrada.entidad,
    clave: entrada.clave,
    antes: entrada.antes === null ? '' : JSON.stringify(entrada.antes),
    despues: entrada.despues === null ? '' : JSON.stringify(entrada.despues),
  };
}

/** Añade una entrada a Auditoria. Solo inserta: el SAS de la app no permite modificar ni borrar. */
export async function auditar(
  cliente: ClienteAuditoria,
  entrada: EntradaAuditoria,
  ahora: Date = new Date(),
): Promise<void> {
  await cliente.createEntity(entidadDeAuditoria(entrada, ahora));
}

/**
 * Audita y, solo si la auditoría se ha guardado, escribe (constitución III: si no se puede auditar,
 * no se escribe). Table Storage no tiene transacciones entre tablas: si la escritura falla después,
 * queda la entrada como rastro del intento.
 */
export async function conAuditoria<T>(
  cliente: ClienteAuditoria,
  entrada: EntradaAuditoria,
  escribir: () => Promise<T>,
): Promise<T> {
  await auditar(cliente, entrada);
  return escribir();
}
