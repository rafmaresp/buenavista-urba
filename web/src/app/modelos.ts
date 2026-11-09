export type Tipo = 'farola' | 'bache' | 'fuga' | 'otro';
export type Estado = 'nuevo' | 'encurso' | 'completado';

export const TIPOS: Record<Tipo, string> = {
  farola: 'Farola fundida',
  bache: 'Bache',
  fuga: 'Fuga de agua',
  otro: 'Otro',
};
export const ESTADOS: Record<Estado, string> = {
  nuevo: 'Nuevo',
  encurso: 'En curso',
  completado: 'Completado',
};
export const LISTA_TIPOS = Object.keys(TIPOS) as Tipo[];
export const LISTA_ESTADOS = Object.keys(ESTADOS) as Estado[];

export interface Farola { id: string; calle: string; lat: number; lon: number; verif: boolean; }
export interface Tramo { calle: string; pts: [number, number][]; }
export interface DatosMapa { farolas: Farola[]; tramos: Tramo[]; }

export interface Incidencia {
  id: string;
  tipo: Tipo;
  farolaId: string | null;
  calle: string | null;
  lat: number;
  lon: number;
  descripcion: string | null;
  estado: Estado;
  votos: number;
  creada: string;
  /** Solo en la vista de gestión. */
  actualizada?: string | null;
  contacto?: string | null;
}

export interface NuevaIncidencia {
  tipo: Tipo;
  farolaId: string | null;
  calle: string | null;
  lat: number;
  lon: number;
  descripcion: string | null;
  contacto: string | null;
}

export const abierta = (i: Incidencia) => i.estado !== 'completado';
