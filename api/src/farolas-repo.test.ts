import { describe, expect, it, vi } from 'vitest';
import { AuditoriaInvalida, type EntidadAuditoria } from './auditoria';
import type { EntidadFarola, Farola } from './farolas';
import {
  AltaSinAuditar,
  type ClienteTablaFarolas,
  FarolaCambiada,
  FarolaNoEncontrada,
  RepositorioFarolas,
  ReubicacionSinAuditar,
} from './farolas-repo';
import { UID_ANA } from './pruebas/usuarios-dobles';

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
    getEntity: vi.fn(),
    updateEntity: vi.fn(),
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

/** Tabla Farolas en memoria con ETag, para reubicar(). */
function tablaConF07(opciones: { auditoriaFalla?: boolean; restaurarFalla?: boolean } = {}) {
  const orden: string[] = [];
  let fila = { partitionKey: 'farola', rowKey: 'F07', calle: 'C. M', lat: 37.31, lon: -5.96, precision: 'estimada', etag: 'W/"1"' };
  let version = 1;
  const farolas = {
    listEntities: vi.fn(),
    createEntity: vi.fn(),
    deleteEntity: vi.fn(),
    getEntity: vi.fn(async <T extends object>(_pk: string, rk: string) => {
      orden.push(`leer ${rk}`);
      if (rk !== fila.rowKey) throw Object.assign(new Error('https://x?sig=secreto'), { name: 'RestError', statusCode: 404 });
      return { ...fila } as unknown as T & { etag: string };
    }),
    updateEntity: vi.fn(async (e: { rowKey: string; lat: number; lon: number; precision: string }, modo: 'Merge', o: { etag: string }) => {
      const restaurar = e.precision === 'estimada';
      orden.push(`${restaurar ? 'restaurar' : 'escribir'} ${e.rowKey} ${modo}`);
      if (restaurar && opciones.restaurarFalla) throw new Error('Table no disponible');
      if (o.etag !== fila.etag) throw Object.assign(new Error('precondición'), { name: 'RestError', statusCode: 412 });
      version++;
      fila = { ...fila, lat: e.lat, lon: e.lon, precision: e.precision, etag: `W/"${version}"` };
      return { etag: fila.etag };
    }),
  } satisfies ClienteTablaFarolas;
  const auditoria = {
    createEntity: vi.fn(async (e: EntidadAuditoria) => {
      orden.push(`auditoria ${e.clave}`);
      if (opciones.auditoriaFalla) throw new Error('Auditoria no disponible');
    }),
  };
  return { orden, farolas, auditoria, fila: () => fila, repo: new RepositorioFarolas(farolas, auditoria) };
}

const NUEVA = { lat: 37.3101, lon: -5.9602 };

describe('RepositorioFarolas.reubicar()', () => {
  it('mueve la farola, fija la precisión a verificada y audita farola.reubicacion con antes y después', async () => {
    const { orden, farolas, auditoria, fila, repo } = tablaConF07();
    const farola = await repo.reubicar('F07', NUEVA, UID_ANA);

    expect(farola).toEqual({ id: 'F07', calle: 'C. M', lat: 37.3101, lon: -5.9602 });
    expect(orden).toEqual(['leer F07', 'escribir F07 Merge', 'auditoria F07']);
    expect(farolas.updateEntity.mock.calls[0]![0]).toEqual({ partitionKey: 'farola', rowKey: 'F07', lat: 37.3101, lon: -5.9602, precision: 'verificada' });
    expect(farolas.updateEntity.mock.calls[0]![2]).toEqual({ etag: 'W/"1"' });
    expect(fila()).toMatchObject({ lat: 37.3101, lon: -5.9602, precision: 'verificada', calle: 'C. M' });

    const entrada = auditoria.createEntity.mock.calls[0]![0];
    expect(entrada).toMatchObject({ actor: UID_ANA, accion: 'farola.reubicacion', entidad: 'Farolas', clave: 'F07' });
    expect(JSON.parse(entrada.antes)).toEqual({ lat: 37.31, lon: -5.96, precision: 'estimada' });
    expect(JSON.parse(entrada.despues)).toEqual({ lat: 37.3101, lon: -5.9602, precision: 'verificada' });
  });

  it('una farola que no existe da FarolaNoEncontrada y no escribe ni audita', async () => {
    const { farolas, auditoria, repo } = tablaConF07();
    await expect(repo.reubicar('F99', NUEVA, UID_ANA)).rejects.toBeInstanceOf(FarolaNoEncontrada);
    expect(farolas.updateEntity).not.toHaveBeenCalled();
    expect(auditoria.createEntity).not.toHaveBeenCalled();
  });

  it('otro error al leer se propaga sin escribir', async () => {
    const { farolas, repo } = tablaConF07();
    farolas.getEntity.mockRejectedValueOnce(Object.assign(new Error('caído'), { statusCode: 500 }));
    await expect(repo.reubicar('F07', NUEVA, UID_ANA)).rejects.toThrow('caído');
    expect(farolas.updateEntity).not.toHaveBeenCalled();
  });

  it('si otro la cambió entre la lectura y la escritura (412), FarolaCambiada sin auditar', async () => {
    const { farolas, auditoria, fila, repo } = tablaConF07();
    farolas.getEntity.mockResolvedValueOnce({ ...fila(), etag: 'W/"viejo"' } as never);
    await expect(repo.reubicar('F07', NUEVA, UID_ANA)).rejects.toBeInstanceOf(FarolaCambiada);
    expect(auditoria.createEntity).not.toHaveBeenCalled();
    expect(fila()).toMatchObject({ lat: 37.31, precision: 'estimada' });
  });

  it('otro error al escribir se propaga sin auditar', async () => {
    const { farolas, auditoria, repo } = tablaConF07();
    farolas.updateEntity.mockRejectedValueOnce(Object.assign(new Error('caído'), { statusCode: 503 }));
    await expect(repo.reubicar('F07', NUEVA, UID_ANA)).rejects.toThrow('caído');
    expect(auditoria.createEntity).not.toHaveBeenCalled();
  });

  it('si la auditoría falla, restaura posición y precisión con el ETag de su escritura y propaga el error', async () => {
    const { orden, farolas, fila, repo } = tablaConF07({ auditoriaFalla: true });
    await expect(repo.reubicar('F07', NUEVA, UID_ANA)).rejects.toThrow('Auditoria no disponible');
    expect(orden).toEqual(['leer F07', 'escribir F07 Merge', 'auditoria F07', 'restaurar F07 Merge']);
    expect(farolas.updateEntity.mock.calls[1]![2]).toEqual({ etag: 'W/"2"' });
    expect(fila()).toMatchObject({ lat: 37.31, lon: -5.96, precision: 'estimada' });
  });

  it('si la auditoría falla y restaurar también, lo avisa con ReubicacionSinAuditar', async () => {
    const { repo } = tablaConF07({ auditoriaFalla: true, restaurarFalla: true });
    await expect(repo.reubicar('F07', NUEVA, UID_ANA)).rejects.toBeInstanceOf(ReubicacionSinAuditar);
  });

  it('si la escritura no devuelve ETag y la auditoría falla, no restaura a ciegas: ReubicacionSinAuditar', async () => {
    const { farolas, repo } = tablaConF07({ auditoriaFalla: true });
    farolas.updateEntity.mockResolvedValueOnce({});
    await expect(repo.reubicar('F07', NUEVA, UID_ANA)).rejects.toBeInstanceOf(ReubicacionSinAuditar);
    expect(farolas.updateEntity).toHaveBeenCalledTimes(1);
  });

  it('con un actor inválido no escribe nada', async () => {
    const { farolas, repo } = tablaConF07();
    await expect(repo.reubicar('F07', NUEVA, 'vecino@example.com')).rejects.toThrow(AuditoriaInvalida);
    expect(farolas.updateEntity).not.toHaveBeenCalled();
  });
});
