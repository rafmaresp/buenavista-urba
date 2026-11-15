import { describe, expect, it, vi } from 'vitest';
import type { EntidadAuditoria } from './auditoria';
import { CANDADO, IncidenciaSinAuditar, RepositorioIncidencias, YaAbierta } from './incidencias-repo';
import { tablaIncidencias } from './pruebas/incidencias-dobles';
import { UID_ANA, UID_BEA } from './pruebas/usuarios-dobles';

const AHORA = new Date('2026-11-15T19:30:00.000Z');

function preparar(opciones: { auditoriaFalla?: boolean; deshacerFalla?: boolean; lecturaFalla?: boolean } = {}) {
  const tabla = tablaIncidencias(opciones);
  const entradas: EntidadAuditoria[] = [];
  const auditoria = {
    createEntity: vi.fn(async (e: EntidadAuditoria) => {
      tabla.orden.push('auditar');
      if (opciones.auditoriaFalla) throw new Error('Auditoria no disponible');
      entradas.push(e);
    }),
  };
  const repo = new RepositorioIncidencias(tabla.cliente, auditoria, () => AHORA);
  return { repo, ...tabla, entradas, auditoria };
}

describe('RepositorioIncidencias.crear() (US1)', () => {
  it('crea la incidencia en Nuevo con el candado y la audita sin el texto del comentario', async () => {
    const { repo, filas, entradas, orden } = preparar();
    const creada = await repo.crear({ farola: 'F07', comentario: 'Parpadea desde ayer', autor: UID_ANA });

    expect(creada).toEqual({ id: expect.any(String), farola: 'F07', estado: 'Nuevo', creada: AHORA.toISOString() });
    expect(filas.get(`F07|${creada.id}`)).toMatchObject({
      tipo: 'farola-fundida',
      estado: 'Nuevo',
      autor: UID_ANA,
      creada: AHORA.toISOString(),
      comentario: 'Parpadea desde ayer',
    });
    expect(filas.get(`F07|${CANDADO}`)).toMatchObject({ incidencia: creada.id });
    expect(orden).toEqual(['crear incidencia', 'crear candado', 'auditar']);

    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({
      actor: UID_ANA,
      accion: 'incidencia.alta',
      entidad: 'Incidencias',
      clave: `F07/${creada.id}`,
      antes: '',
    });
    expect(JSON.parse(entradas[0]!.despues)).toEqual({
      farola: 'F07',
      estado: 'Nuevo',
      comentarioPresente: true,
      comentarioLongitud: 19,
    });
    expect(JSON.stringify(entradas[0])).not.toContain('Parpadea');
  });

  it('sin comentario audita comentarioPresente false y longitud 0', async () => {
    const { repo, entradas } = preparar();
    await repo.crear({ farola: 'F01', comentario: '', autor: UID_ANA });
    expect(JSON.parse(entradas[0]!.despues)).toMatchObject({ comentarioPresente: false, comentarioLongitud: 0 });
  });

  it('con un actor no válido no escribe nada', async () => {
    const { repo, filas, auditoria } = preparar();
    await expect(repo.crear({ farola: 'F01', comentario: '', autor: 'ana@example.com' })).rejects.toThrow('actor no válido');
    expect(filas.size).toBe(0);
    expect(auditoria.createEntity).not.toHaveBeenCalled();
  });

  it('si la auditoría falla deshace el alta y la farola vuelve a admitir un aviso', async () => {
    const { repo, filas, orden } = preparar({ auditoriaFalla: true });
    await expect(repo.crear({ farola: 'F07', comentario: '', autor: UID_ANA })).rejects.toThrow('Auditoria no disponible');
    expect(orden).toEqual(['crear incidencia', 'crear candado', 'auditar', 'borrar candado', 'borrar incidencia']);
    expect(filas.size).toBe(0);
  });

  it('si deshacer también falla lanza IncidenciaSinAuditar', async () => {
    const { repo } = preparar({ auditoriaFalla: true, deshacerFalla: true });
    await expect(repo.crear({ farola: 'F07', comentario: '', autor: UID_ANA })).rejects.toBeInstanceOf(IncidenciaSinAuditar);
  });
});

describe('RepositorioIncidencias — sin duplicados (US2)', () => {
  it('una segunda incidencia en la misma farola lanza YaAbierta con la existente, sin escribir ni auditar', async () => {
    const { repo, filas, entradas } = preparar();
    const primera = await repo.crear({ farola: 'F07', comentario: '', autor: UID_ANA });

    const error = await repo.crear({ farola: 'F07', comentario: 'Otra', autor: UID_BEA }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(YaAbierta);
    expect((error as YaAbierta).existente).toEqual(primera);
    // La fila de la segunda se borra: solo quedan la primera y su candado.
    expect(filas.size).toBe(2);
    expect(entradas).toHaveLength(1);
  });

  it('otra farola sí admite su incidencia', async () => {
    const { repo, filas } = preparar();
    await repo.crear({ farola: 'F07', comentario: '', autor: UID_ANA });
    await repo.crear({ farola: 'F08', comentario: '', autor: UID_ANA });
    expect(filas.size).toBe(4);
  });

  it('si el candado falla por otro motivo deshace la incidencia y propaga el error', async () => {
    const { repo, filas, cliente } = preparar();
    const original = cliente.createEntity.getMockImplementation()!;
    cliente.createEntity.mockImplementation(async (e) => {
      if (e.rowKey === CANDADO) throw Object.assign(new Error('caída'), { statusCode: 500 });
      return original(e);
    });
    await expect(repo.crear({ farola: 'F07', comentario: '', autor: UID_ANA })).rejects.toMatchObject({ statusCode: 500 });
    expect(filas.size).toBe(0);
  });

  it('abiertaDe() devuelve undefined si la farola no tiene incidencia', async () => {
    const { repo } = preparar();
    expect(await repo.abiertaDe('F09')).toBeUndefined();
  });
});

describe('RepositorioIncidencias.abiertas() (US3)', () => {
  it('devuelve solo las abiertas, por farola, sin autor ni comentario', async () => {
    const { repo, filas, cliente } = preparar();
    await repo.crear({ farola: 'F09', comentario: 'Secreto', autor: UID_ANA });
    await repo.crear({ farola: 'F02', comentario: '', autor: UID_BEA });
    // Sin candado no está abierta: una completada (historial) o un alta a medias.
    filas.set('F03|vieja', { partitionKey: 'F03', rowKey: 'vieja', estado: 'Completado', creada: '2026-01-01T00:00:00.000Z', autor: UID_ANA, comentario: '' });
    filas.set('F04|suelta', { partitionKey: 'F04', rowKey: 'suelta', estado: 'Nuevo', creada: '2026-01-01T00:00:00.000Z', autor: UID_ANA, comentario: '' });

    const abiertas = await repo.abiertas();
    expect(abiertas.map((i) => i.farola)).toEqual(['F02', 'F09']);
    for (const i of abiertas) expect(Object.keys(i).sort()).toEqual(['creada', 'estado', 'farola', 'id']);
    expect(JSON.stringify(abiertas)).not.toMatch(/Secreto|autor|comentario/);
    expect(cliente.listEntities).toHaveBeenCalledWith({
      queryOptions: { select: ['PartitionKey', 'RowKey', 'estado', 'creada', 'incidencia'] },
    });
  });

  it('propaga el error de lectura', async () => {
    const { repo } = preparar({ lecturaFalla: true });
    await expect(repo.abiertas()).rejects.toMatchObject({ statusCode: 500 });
  });
});
