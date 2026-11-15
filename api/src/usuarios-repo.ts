import { odata } from '@azure/data-tables';
import { type ClienteAuditoria, auditar, entidadDeAuditoria } from './auditoria';
import { PARTICION_USUARIOS, type Usuario } from './usuarios';

interface EntidadUsuario {
  rowKey?: string;
  etag?: string;
  email?: string;
  sub?: string;
  rol?: string;
  estado?: string;
}

/** Lo que el repositorio necesita de la tabla Usuarios (el SAS de la app solo permite leer y actualizar). */
export interface ClienteTablaUsuarios {
  listEntities<T extends object>(options?: { queryOptions?: { filter?: string } }): AsyncIterable<T>;
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
