import type { Farola } from './farolas';
import type { RepositorioFarolas } from './farolas-repo';

export const ACTOR_CARGA = 'sistema:carga';

export interface ResultadoCarga {
  altas: string[];
  existentes: number;
}

/**
 * Siembra el catálogo como una migración de datos: da de alta solo las farolas que faltan y nunca
 * toca una existente (su posición vigente puede venir de una reubicación). El repositorio audita
 * cada alta con actor `sistema:carga`, y su `createEntity` falla si otra carga la creó a la vez.
 */
export async function cargarFarolas(repo: RepositorioFarolas, semilla: Farola[]): Promise<ResultadoCarga> {
  const existentes = await repo.ids();
  const altas: string[] = [];
  for (const farola of semilla) {
    if (existentes.has(farola.id)) continue;
    await repo.crear(farola, ACTOR_CARGA);
    altas.push(farola.id);
  }
  return { altas, existentes: existentes.size };
}
