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
  /** Fecha ISO de la baja; vacía si está activo. */
  baja: string;
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

/** Forma mínima de un correo ya normalizado (sin espacios ni comas, con @ y dominio con punto). */
export function esEmailValido(email: string): boolean {
  return email.length <= 254 && FORMA_EMAIL.test(email);
}

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
    if (!esEmailValido(email)) {
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

// ---------- Gestión por la directiva (specs/009-gestion-usuarios) ----------

/** Estados que la directiva puede poner: `suprimido` es solo de los devs. */
export const ESTADOS_GESTION = ['activo', 'baja'] as const;
export type EstadoGestion = (typeof ESTADOS_GESTION)[number];

export interface CambioUsuario {
  rol?: Rol;
  estado?: EstadoGestion;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esUid(valor: string | undefined): valor is string {
  return typeof valor === 'string' && UUID.test(valor);
}

function esObjetoConClaves(valor: unknown, permitidas: readonly string[]): valor is Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return false;
  return Object.keys(valor).every((k) => permitidas.includes(k));
}

/** Cuerpo de POST /api/usuarios: exactamente `email` y `rol`. Devuelve el alta normalizada o undefined. */
export function validarAlta(cuerpo: unknown): AltaUsuario | undefined {
  if (!esObjetoConClaves(cuerpo, ['email', 'rol'])) return undefined;
  const { email, rol } = cuerpo;
  if (typeof email !== 'string' || typeof rol !== 'string') return undefined;
  const normalizado = normalizarEmail(email);
  if (!esEmailValido(normalizado) || !esRol(rol)) return undefined;
  return { email: normalizado, rol };
}

/** Cuerpo de PATCH /api/usuarios/{uid}: `rol` y/o `estado` (activo o baja), al menos uno y nada más. */
export function validarCambio(cuerpo: unknown): CambioUsuario | undefined {
  if (!esObjetoConClaves(cuerpo, ['rol', 'estado'])) return undefined;
  const cambio: CambioUsuario = {};
  if ('rol' in cuerpo) {
    if (typeof cuerpo.rol !== 'string' || !esRol(cuerpo.rol)) return undefined;
    cambio.rol = cuerpo.rol;
  }
  if ('estado' in cuerpo) {
    const estado = cuerpo.estado;
    if (typeof estado !== 'string' || !(ESTADOS_GESTION as readonly string[]).includes(estado)) return undefined;
    cambio.estado = estado as EstadoGestion;
  }
  return cambio.rol || cambio.estado ? cambio : undefined;
}
