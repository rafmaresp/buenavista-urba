import { describe, expect, it, vi } from 'vitest';
import { AuditoriaInvalida, type EntidadAuditoria } from './auditoria';
import type { EntidadFarola, Farola } from './farolas';
import { AltaSinAuditar, type ClienteTablaFarolas, RepositorioFarolas } from './farolas-repo';

const f07: Farola = { id: 'F07', calle: 'C. M', lat: 37.31, lon: -5.96, precision: 'estimada' };

function dobles(opciones: { auditoriaFalla?: boolean; deshacerFalla?: boolean } = {}) {
  const orden: string[] = [];
  const farolas = {
    listEntities: vi.fn(),
    createEntity: vi.fn(async (e: EntidadFarola) => {
      orden.push(`alta ${e.rowKey}`);
    }),
    deleteEntity: vi.fn(async (_pk: string, rk: string) => {
      orden.push(`deshacer ${rk}`);
      if (opciones.deshacerFalla) throw new Error('Table no disponible');
    }),
  } satisfies ClienteTablaFarolas;
  const auditoria = {
    createEntity: vi.fn(async (e: EntidadAuditoria) => {
      orden.push(`auditoria ${e.clave}`);
      if (opciones.auditoriaFalla) throw new Error('Auditoria no disponible');
    }),
  };
  return { orden, farolas, auditoria, repo: new RepositorioFarolas(farolas, auditoria) };
}

describe('RepositorioFarolas.crear()', () => {
  it('escribe la farola y, como efecto, su entrada de auditoría farola.alta', async () => {
    const { orden, auditoria, repo } = dobles();
    await repo.crear(f07, 'sistema:carga');

    expect(orden).toEqual(['alta F07', 'auditoria F07']);
    const entrada = auditoria.createEntity.mock.calls[0]![0];
    expect(entrada).toMatchObject({ actor: 'sistema:carga', accion: 'farola.alta', entidad: 'Farolas', clave: 'F07', antes: '' });
    expect(JSON.parse(entrada.despues)).toEqual({ calle: 'C. M', lat: 37.31, lon: -5.96, precision: 'estimada' });
  });

  it('si la auditoría falla, deshace el alta y propaga el error', async () => {
    const { orden, repo } = dobles({ auditoriaFalla: true });
    await expect(repo.crear(f07, 'sistema:carga')).rejects.toThrow('Auditoria no disponible');
    expect(orden).toEqual(['alta F07', 'auditoria F07', 'deshacer F07']);
  });

  it('si la auditoría falla y deshacer también, lo avisa con AltaSinAuditar', async () => {
    const { repo } = dobles({ auditoriaFalla: true, deshacerFalla: true });
    await expect(repo.crear(f07, 'sistema:carga')).rejects.toThrow(AltaSinAuditar);
  });

  it('con un actor inválido no escribe nada', async () => {
    const { orden, repo } = dobles();
    await expect(repo.crear(f07, 'vecino@example.com')).rejects.toThrow(AuditoriaInvalida);
    expect(orden).toEqual([]);
  });

  it('si el alta falla (por ejemplo, ya existe), no audita', async () => {
    const { farolas, auditoria, repo } = dobles();
    farolas.createEntity.mockRejectedValueOnce(Object.assign(new Error('conflict'), { statusCode: 409 }));
    await expect(repo.crear(f07, 'sistema:carga')).rejects.toThrow('conflict');
    expect(auditoria.createEntity).not.toHaveBeenCalled();
    expect(farolas.deleteEntity).not.toHaveBeenCalled();
  });
});
