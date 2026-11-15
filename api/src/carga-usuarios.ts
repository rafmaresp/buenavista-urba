import { ACTOR_CARGA } from './carga-farolas';
import type { AltaUsuario } from './usuarios';
import type { RepositorioUsuarios } from './usuarios-repo';

export interface ResultadoCargaUsuarios {
  altas: number;
  existentes: number;
}

/**
 * Da de alta, como la siembra de farolas, solo los correos que aún no están en la lista cerrada y
 * nunca toca un usuario existente (ni su rol ni su estado). Cada alta la audita el repositorio con
 * actor `sistema:carga`. Solo devuelve recuentos: los correos no salen de aquí.
 */
export async function cargarUsuarios(repo: RepositorioUsuarios, lista: AltaUsuario[]): Promise<ResultadoCargaUsuarios> {
  if (!lista.length) return { altas: 0, existentes: 0 };
  const registrados = await repo.emails();
  let altas = 0;
  let existentes = 0;
  for (const alta of lista) {
    if (registrados.has(alta.email)) {
      existentes++;
      continue;
    }
    await repo.crear(alta, ACTOR_CARGA);
    altas++;
  }
  return { altas, existentes };
}
