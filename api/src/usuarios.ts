/** Lista cerrada (spec 005-login-roles): quién puede usar la app y con qué rol. */

export const PARTICION_USUARIOS = 'usuario';

export const ROLES = ['comunero', 'directiva'] as const;
export type Rol = (typeof ROLES)[number];

export const ESTADOS = ['activo', 'baja', 'suprimido'] as const;
export type EstadoUsuario = (typeof ESTADOS)[number];

/** Fila de la tabla Usuarios. `uid` (UUID v4 aleatorio) es la única correspondencia con la persona. */
export interface Usuario {
  uid: string;
  /** Normalizado con normalizarEmail(); vacío si está suprimido. */
  email: string;
  /** Identificador de Google; vacío hasta el primer login y si está suprimido. */
  sub: string;
  /** Lo que haya en la tabla: identificar() rechaza un valor fuera de ROLES. */
  rol: string;
  estado: string;
  /** ETag de la fila, para actualizar sin pisar un cambio concurrente. */
  etag: string;
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function esRol(valor: string): valor is Rol {
  return (ROLES as readonly string[]).includes(valor);
}
