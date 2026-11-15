import { randomUUID } from 'node:crypto';
import { odata } from '@azure/data-tables';
import { type ClienteAuditoria, auditar, entidadDeAuditoria } from './auditoria';
import { type AltaUsuario, PARTICION_USUARIOS, type Usuario } from './usuarios';

interface EntidadUsuario {
  rowKey?: string;
  etag?: string;
  email?: string;
  sub?: string;
  rol?: string;
  estado?: string;
}

/** Fila completa que crea un alta (data-model de specs/007-alta-usuarios). */
export interface EntidadAltaUsuario {
  partitionKey: string;
  rowKey: string;
  email: string;
  sub: string;
  rol: string;
  estado: string;
  alta: string;
  baja: string;
}

/**
 * Lo que el repositorio necesita de la tabla Usuarios. El SAS de la app solo permite leer y actualizar
 * (`ru`): crear y borrar solo funcionan con el SAS `rad` de la carga en el despliegue de infra.
 */
export interface ClienteTablaUsuarios {
  listEntities<T extends object>(options?: { queryOptions?: { filter?: string; select?: string[] } }): AsyncIterable<T>;
  createEntity(entity: EntidadAltaUsuario): Promise<unknown>;
  deleteEntity(partitionKey: string, rowKey: string): Promise<unknown>;
  updateEntity(
    entity: { partitionKey: string; rowKey: string; sub: string },
    mode: 'Merge',
    options?: { etag?: string },
  ): Promise<unknown>;
}

/**
 * Única puerta de lectura y escritura de Usuarios. Como RepositorioFarolas, la auditoría es un
 * efecto de cada escritura: escribe, audita y, si la auditoría falla, deshace y propaga el error.
 */
export class RepositorioUsuarios {
  constructor(
    private readonly usuarios: ClienteTablaUsuarios,
    private readonly auditoria: ClienteAuditoria,
  ) {}

  buscarPorSub(sub: string): Promise<Usuario[]> {
    return this.buscar(odata`PartitionKey eq ${PARTICION_USUARIOS} and sub eq ${sub}`);
  }

  /** `email` ya normalizado. */
  buscarPorEmail(email: string): Promise<Usuario[]> {
    return this.buscar(odata`PartitionKey eq ${PARTICION_USUARIOS} and email eq ${email}`);
  }

  /** Correos (normalizados) de todas las filas, en cualquier estado: decide qué altas faltan. */
  async emails(): Promise<Set<string>> {
    const emails = new Set<string>();
    const filter = odata`PartitionKey eq ${PARTICION_USUARIOS}`;
    for await (const e of this.usuarios.listEntities<EntidadUsuario>({ queryOptions: { filter, select: ['email'] } })) {
      if (e.email) emails.add(e.email);
    }
    return emails;
  }

  /**
   * Da de alta un usuario activo con uid aleatorio y sin `sub`, y lo audita como `usuario.alta`
   * (clave = uid; después solo rol y estado, nunca el correo). Si la auditoría falla, borra la fila.
   */
  async crear(alta: AltaUsuario, actor: string): Promise<string> {
    const uid = randomUUID();
    const entidad: EntidadAltaUsuario = {
      partitionKey: PARTICION_USUARIOS,
      rowKey: uid,
      email: alta.email,
      sub: '',
      rol: alta.rol,
      estado: 'activo',
      alta: new Date().toISOString(),
      baja: '',
    };
    const entrada = entidadDeAuditoria({
      actor,
      accion: 'usuario.alta',
      entidad: 'Usuarios',
      clave: uid,
      antes: null,
      despues: { rol: alta.rol, estado: 'activo' },
    });

    await this.usuarios.createEntity(entidad);
    try {
      await auditar(this.auditoria, entrada);
    } catch (errorAuditoria) {
      try {
        await this.usuarios.deleteEntity(PARTICION_USUARIOS, uid);
      } catch {
        throw new AltaUsuarioSinAuditar(uid);
      }
      throw errorAuditoria;
    }
    return uid;
  }

  private async buscar(filter: string): Promise<Usuario[]> {
    const encontrados: Usuario[] = [];
    for await (const e of this.usuarios.listEntities<EntidadUsuario>({ queryOptions: { filter } })) {
      encontrados.push({
        uid: String(e.rowKey),
        email: e.email ?? '',
        sub: e.sub ?? '',
        rol: e.rol ?? '',
        estado: e.estado ?? '',
        etag: e.etag ?? '',
      });
    }
    return encontrados;
  }

  /**
   * Fija el `sub` de Google en el primer login (solo si la fila no cambió desde que se leyó) y lo
   * audita como `usuario.vincular` con el uid: ni el email ni el `sub` llegan a la auditoría.
   */
  async vincularSub(usuario: Usuario, sub: string): Promise<void> {
    const entrada = entidadDeAuditoria({
      actor: usuario.uid,
      accion: 'usuario.vincular',
      entidad: 'Usuarios',
      clave: usuario.uid,
      antes: { vinculado: false },
      despues: { vinculado: true },
    });
    const clave = { partitionKey: PARTICION_USUARIOS, rowKey: usuario.uid };

    await this.usuarios.updateEntity({ ...clave, sub }, 'Merge', { etag: usuario.etag });
    try {
      await auditar(this.auditoria, entrada);
    } catch (errorAuditoria) {
      try {
        await this.usuarios.updateEntity({ ...clave, sub: '' }, 'Merge');
      } catch {
        throw new VinculacionSinAuditar(usuario.uid);
      }
      throw errorAuditoria;
    }
  }
}

/** La auditoría falló y no se pudo deshacer la vinculación: hay que revisarlo a mano. */
export class VinculacionSinAuditar extends Error {
  constructor(uid: string) {
    super(`El usuario ${uid} quedó vinculado sin auditar y no se pudo deshacer: revísalo a mano`);
    this.name = 'VinculacionSinAuditar';
  }
}

/** La auditoría de un alta falló y no se pudo borrar la fila: hay que revisarlo a mano. */
export class AltaUsuarioSinAuditar extends Error {
  constructor(uid: string) {
    super(`El usuario ${uid} se dio de alta sin auditar y no se pudo deshacer: revísalo a mano`);
    this.name = 'AltaUsuarioSinAuditar';
  }
}
