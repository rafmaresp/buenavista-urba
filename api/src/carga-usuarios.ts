import { ACTOR_CARGA } from './carga-farolas';
import { type AltaUsuario, AltasInvalidas, parsearAltas } from './usuarios';
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

export interface SalidaCarga {
  /** Líneas para stdout (y el resumen del job). */
  salida: string[];
  /** Líneas para stderr. */
  errores: string[];
  codigo: 0 | 1;
}

/**
 * Lo que hace el script `cargar-usuarios`, separado para poder probarlo. Lee USUARIOS_ALTA de `env`;
 * sin lista no abre las tablas. Ninguna línea de salida lleva correos ni cadenas de conexión.
 */
export async function ejecutarCargaUsuarios(
  env: NodeJS.ProcessEnv,
  crearRepo: () => RepositorioUsuarios,
): Promise<SalidaCarga> {
  const texto = env.USUARIOS_ALTA ?? '';
  if (!texto.trim()) return { salida: ['Sin USUARIOS_ALTA: no se da de alta a nadie.'], errores: [], codigo: 0 };
  try {
    const lista = parsearAltas(texto);
    const resultado = await cargarUsuarios(crearRepo(), lista);
    return {
      salida: [`Lista: ${lista.length} usuarios. Ya existían: ${resultado.existentes}. Altas: ${resultado.altas}.`],
      errores: [],
      codigo: 0,
    };
  } catch (e: unknown) {
    if (e instanceof AltasInvalidas) {
      return { salida: [], errores: [...e.errores, 'La carga ha fallado: lista de altas inválida (no se ha escrito nada).'], codigo: 1 };
    }
    const error = e as { name?: string; message?: string; statusCode?: number };
    // Un RestError puede llevar la URL con el SAS en el mensaje: solo nombre y código.
    const detalle = error.statusCode ? `${error.name} ${error.statusCode}` : `${error.name}: ${error.message}`;
    return { salida: [], errores: [`La carga ha fallado: ${detalle}`], codigo: 1 };
  }
}
