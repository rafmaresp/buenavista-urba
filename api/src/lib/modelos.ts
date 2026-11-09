export const TIPOS = ['farola', 'bache', 'fuga', 'otro'] as const;
export type Tipo = (typeof TIPOS)[number];
export const ESTADOS = ['nuevo', 'encurso', 'completado'] as const;
export type Estado = (typeof ESTADOS)[number];

/** Fila en Table Storage. Fechas en ISO 8601. */
export interface IncidenciaEntity {
  partitionKey: string;
  rowKey: string;
  tipo: Tipo;
  farolaId?: string;
  calle?: string;
  lat: number;
  lon: number;
  descripcion?: string;
  /** Contacto opcional del vecino. Solo se expone en /api/gestion. */
  contacto?: string;
  estado: Estado;
  votos: number;
  creada: string;
  actualizada?: string;
}

/** Lo que ven los vecinos: nunca incluye el contacto. */
export const aPublica = (e: IncidenciaEntity) => ({
  id: e.rowKey,
  tipo: e.tipo,
  farolaId: e.farolaId ?? null,
  calle: e.calle ?? null,
  lat: e.lat,
  lon: e.lon,
  descripcion: e.descripcion ?? null,
  estado: e.estado,
  votos: e.votos,
  creada: e.creada,
});

/** Vista de gestión (junta): incluye el contacto. */
export const aGestion = (e: IncidenciaEntity) => ({
  ...aPublica(e),
  actualizada: e.actualizada ?? null,
  contacto: e.contacto ?? null,
});

export interface NuevaIncidencia {
  tipo?: unknown;
  farolaId?: unknown;
  calle?: unknown;
  lat?: unknown;
  lon?: unknown;
  descripcion?: unknown;
  contacto?: unknown;
}
