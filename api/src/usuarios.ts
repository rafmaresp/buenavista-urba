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

/** Una línea de la lista de altas (secreto USUARIOS_ALTA): solo existe en memoria durante la carga. */
export interface AltaUsuario {
  email: string;
  rol: Rol;
}

const FORMA_EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/** La lista de altas tiene líneas inválidas. El mensaje lleva números de línea y motivos, nunca correos. */
export class AltasInvalidas extends Error {
  constructor(readonly errores: string[]) {
    super(`La lista de altas tiene ${errores.length} línea(s) inválida(s): ${errores.join('; ')}`);
    this.name = 'AltasInvalidas';
  }
}

/**
 * Valida toda la lista (`correo,rol` por línea) antes de escribir nada. Recorta espacios, ignora
 * líneas en blanco y normaliza el correo; un correo repetido tras normalizar es un error.
 */
export function parsearAltas(texto: string): AltaUsuario[] {
  const altas: AltaUsuario[] = [];
  const errores: string[] = [];
  const vistas = new Map<string, number>();
  texto.split(/\r?\n/).forEach((bruta, i) => {
    const linea = i + 1;
    if (!bruta.trim()) return;
    const [correo, rolBruto, ...sobra] = bruta.split(',');
    if (rolBruto === undefined || sobra.length) {
      errores.push(`Línea ${linea}: se esperaba "correo,rol"`);
      return;
    }
    const email = normalizarEmail(correo!);
    const rol = rolBruto.trim();
    if (!FORMA_EMAIL.test(email)) {
      errores.push(`Línea ${linea}: correo no válido`);
      return;
    }
    if (!esRol(rol)) {
      errores.push(`Línea ${linea}: rol desconocido (comunero o directiva)`);
      return;
    }
    const anterior = vistas.get(email);
    if (anterior) {
      errores.push(`Línea ${linea}: correo repetido con la línea ${anterior}`);
      return;
    }
    vistas.set(email, linea);
    altas.push({ email, rol });
  });
  if (errores.length) throw new AltasInvalidas(errores);
  return altas;
}
