// Dobles de la tabla Usuarios y de Auditoria para las unitarias (sin datos reales).
import { vi } from 'vitest';
import type { EntidadAuditoria } from '../auditoria';
import type { ClienteTablaUsuarios, EntidadAltaUsuario } from '../usuarios-repo';

export interface FilaUsuario {
  rowKey: string;
  email: string;
  sub: string;
  rol: string;
  estado: string;
  etag: string;
}

export const UID_ANA = '0b9c4f3e-6a1d-4c8e-9f2a-1d3e5b7c9a01';
export const UID_BEA = '7f1e2d3c-4b5a-4968-8776-655443322110';

export function filaAna(cambios: Partial<FilaUsuario> = {}): FilaUsuario {
  return { rowKey: UID_ANA, email: 'ana@example.com', sub: '', rol: 'comunero', estado: 'activo', etag: 'W/"1"', ...cambios };
}

/** Tabla en memoria que entiende los filtros de RepositorioUsuarios (por sub, por email o toda la partición). */
export function tablaUsuarios(
  filas: FilaUsuario[],
  opciones: { lecturaFalla?: boolean; deshacerFalla?: boolean; borrarFalla?: boolean } = {},
) {
  const orden: string[] = [];
  const creadas: EntidadAltaUsuario[] = [];
  const cliente = {
    listEntities: vi.fn(<T extends object>(options?: { queryOptions?: { filter?: string } }) => {
      const filtro = options?.queryOptions?.filter ?? '';
      const campo = filtro.includes(' sub eq ') ? 'sub' : filtro.includes(' email eq ') ? 'email' : undefined;
      const valor = /eq '([^']*)'$/.exec(filtro)?.[1];
      return (async function* () {
        if (opciones.lecturaFalla) throw Object.assign(new Error('https://x?sig=secreto'), { name: 'RestError', statusCode: 500 });
        for (const f of filas) if (!campo || f[campo] === valor) yield { ...f } as unknown as T;
      })();
    }),
    createEntity: vi.fn(async (e: EntidadAltaUsuario) => {
      orden.push(`alta ${e.rowKey}`);
      creadas.push(e);
      filas.push({ rowKey: e.rowKey, email: e.email, sub: e.sub, rol: e.rol, estado: e.estado, etag: 'W/"1"' });
    }),
    deleteEntity: vi.fn(async (_pk: string, rowKey: string) => {
      orden.push(`borrar ${rowKey}`);
      if (opciones.borrarFalla) throw new Error('Table no disponible');
      filas.splice(filas.findIndex((f) => f.rowKey === rowKey), 1);
    }),
    updateEntity: vi.fn(async (e: { rowKey: string; sub: string }, _modo: 'Merge', o?: { etag?: string }) => {
      const fila = filas.find((f) => f.rowKey === e.rowKey)!;
      if (e.sub === '') {
        orden.push(`deshacer ${e.rowKey}`);
        if (opciones.deshacerFalla) throw new Error('Table no disponible');
      } else {
        orden.push(`vincular ${e.rowKey}`);
        if (o?.etag !== fila.etag) throw Object.assign(new Error('precondición'), { name: 'RestError', statusCode: 412 });
      }
      fila.sub = e.sub;
    }),
  } satisfies ClienteTablaUsuarios;
  return { cliente, orden, creadas };
}

export function auditoriaDoble(orden: string[], falla = false) {
  return {
    createEntity: vi.fn(async (e: EntidadAuditoria) => {
      orden.push(`auditoria ${e.clave}`);
      if (falla) throw new Error('Auditoria no disponible');
    }),
  };
}
