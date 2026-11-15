import { describe, expect, it, vi } from 'vitest';
import type { EntidadAuditoria } from './auditoria';
import {
  CANDADO,
  HaCambiado,
  IncidenciaSinAuditar,
  NoEncontrada,
  RepositorioIncidencias,
  TransicionNoValida,
  YaAbierta,
} from './incidencias-repo';
import { type OpcionesTablaIncidencias, tablaIncidencias } from './pruebas/incidencias-dobles';
import { UID_ANA, UID_BEA } from './pruebas/usuarios-dobles';

const AHORA = new Date('2026-11-15T19:30:00.000Z');

function preparar(opciones: { auditoriaFalla?: boolean } & OpcionesTablaIncidencias = {}) {
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

describe('RepositorioIncidencias.cambiarEstado() (spec 007)', () => {
  async function conIncidencia(opciones: Parameters<typeof preparar>[0] = {}) {
    const p = preparar(opciones);
    // El alta se hace con otra instancia sin fallos para partir de una incidencia abierta en Nuevo.
    const tablaSinFallos = new RepositorioIncidencias(p.cliente, { createEntity: async () => undefined }, () => AHORA);
    const creada = await tablaSinFallos.crear({ farola: 'F07', comentario: 'Texto privado', autor: UID_ANA });
    p.orden.length = 0;
    return { ...p, creada };
  }

  it('avanza el estado y audita solo el estado antes y después, con el uid de la directiva (US1)', async () => {
    const { repo, creada, filas, entradas, orden } = await conIncidencia();
    const r = await repo.cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Recibido', actor: UID_BEA });

    expect(r).toEqual({ ...creada, estado: 'Recibido' });
    expect(filas.get(`F07|${creada.id}`)).toMatchObject({ estado: 'Recibido', autor: UID_ANA, comentario: 'Texto privado' });
    expect(filas.has(`F07|${CANDADO}`)).toBe(true);
    expect(orden).toEqual(['estado Recibido', 'auditar']);
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({ actor: UID_BEA, accion: 'incidencia.estado', entidad: 'Incidencias', clave: `F07/${creada.id}` });
    expect(JSON.parse(entradas[0]!.antes)).toEqual({ estado: 'Nuevo' });
    expect(JSON.parse(entradas[0]!.despues)).toEqual({ estado: 'Recibido' });
    expect(JSON.stringify(entradas[0])).not.toContain('Texto privado');
    expect(JSON.stringify(entradas[0])).not.toContain(UID_ANA);
  });

  it('se pueden saltar estados hacia delante', async () => {
    const { repo, creada } = await conIncidencia();
    await expect(
      repo.cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Profesional notificado', actor: UID_BEA }),
    ).resolves.toMatchObject({ estado: 'Profesional notificado' });
  });

  it('rechaza volver atrás o repetir el estado sin escribir ni auditar', async () => {
    const { repo, creada, entradas, cliente } = await conIncidencia();
    await repo.cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Profesional notificado', actor: UID_BEA });
    cliente.updateEntity.mockClear();
    for (const estado of ['Nuevo', 'Recibido', 'Profesional notificado'] as const) {
      const error = await repo.cambiarEstado({ farola: 'F07', id: creada.id, estado, actor: UID_BEA }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TransicionNoValida);
      expect((error as TransicionNoValida).actual).toMatchObject({ estado: 'Profesional notificado' });
    }
    expect(cliente.updateEntity).not.toHaveBeenCalled();
    expect(entradas).toHaveLength(1);
  });

  it('solo la incidencia del candado es modificable: otra id, otra farola o sin incidencia → NoEncontrada', async () => {
    const { repo, creada } = await conIncidencia();
    const otra = '11111111-2222-4333-8444-555555555555';
    await expect(repo.cambiarEstado({ farola: 'F07', id: otra, estado: 'Recibido', actor: UID_BEA })).rejects.toBeInstanceOf(NoEncontrada);
    await expect(repo.cambiarEstado({ farola: 'F01', id: creada.id, estado: 'Recibido', actor: UID_BEA })).rejects.toBeInstanceOf(
      NoEncontrada,
    );
  });

  it('si otro cambio gana (ETag desfasado) no lo pisa y devuelve el estado actual', async () => {
    const { repo, creada, filas, entradas } = await conIncidencia({ carreraA: 'Recibido' });
    const error = await repo
      .cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Completado', actor: UID_BEA })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HaCambiado);
    expect((error as HaCambiado).actual).toEqual({ ...creada, estado: 'Recibido' });
    expect(filas.get(`F07|${creada.id}`)).toMatchObject({ estado: 'Recibido' });
    expect(filas.has(`F07|${CANDADO}`)).toBe(true);
    expect(entradas).toHaveLength(0);
  });

  it('si la auditoría falla restaura el estado anterior y propaga el error (US1)', async () => {
    const { repo, creada, filas, orden } = await conIncidencia({ auditoriaFalla: true });
    await expect(repo.cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Recibido', actor: UID_BEA })).rejects.toThrow(
      'Auditoria no disponible',
    );
    expect(filas.get(`F07|${creada.id}`)).toMatchObject({ estado: 'Nuevo' });
    expect(orden).toEqual(['estado Recibido', 'auditar', 'estado Nuevo']);
  });

  it('si restaurar también falla lanza IncidenciaSinAuditar', async () => {
    const { repo, creada } = await conIncidencia({ auditoriaFalla: true, actualizarFallaEn: 2 });
    await expect(
      repo.cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Recibido', actor: UID_BEA }),
    ).rejects.toBeInstanceOf(IncidenciaSinAuditar);
  });

  it('completar borra el candado: deja de estar abierta y la farola admite otro aviso (US2)', async () => {
    const { repo, creada, filas, orden, entradas } = await conIncidencia();
    await repo.cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Completado', actor: UID_BEA });

    expect(orden).toEqual(['estado Completado', 'borrar candado', 'auditar']);
    expect(filas.has(`F07|${CANDADO}`)).toBe(false);
    expect(filas.get(`F07|${creada.id}`)).toMatchObject({ estado: 'Completado' });
    expect(await repo.abiertas()).toEqual([]);
    expect(await repo.abiertaDe('F07')).toBeUndefined();
    expect(JSON.parse(entradas[0]!.despues)).toEqual({ estado: 'Completado' });

    const nueva = await repo.crear({ farola: 'F07', comentario: '', autor: UID_ANA });
    expect(nueva.id).not.toBe(creada.id);
    expect(await repo.abiertaDe('F07')).toEqual(nueva);
    // Una completada no se reabre: ya no es la del candado.
    await expect(repo.cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Completado', actor: UID_BEA })).rejects.toBeInstanceOf(
      NoEncontrada,
    );
  });

  it('si la auditoría falla al completar recrea el candado y restaura el estado (US2)', async () => {
    const { repo, creada, filas, orden } = await conIncidencia({ auditoriaFalla: true });
    await expect(repo.cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Completado', actor: UID_BEA })).rejects.toThrow();

    expect(orden).toEqual(['estado Completado', 'borrar candado', 'auditar', 'crear candado', 'estado Nuevo']);
    expect(filas.get(`F07|${CANDADO}`)).toMatchObject({ incidencia: creada.id });
    expect(filas.get(`F07|${creada.id}`)).toMatchObject({ estado: 'Nuevo' });
    await expect(repo.abiertaDe('F07')).resolves.toEqual(creada);
  });

  it('si borrar el candado falla restaura el estado y no audita', async () => {
    const { repo, creada, filas, entradas } = await conIncidencia({ borrarCandadoFalla: true });
    await expect(
      repo.cambiarEstado({ farola: 'F07', id: creada.id, estado: 'Completado', actor: UID_BEA }),
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(filas.get(`F07|${creada.id}`)).toMatchObject({ estado: 'Nuevo' });
    expect(filas.has(`F07|${CANDADO}`)).toBe(true);
    expect(entradas).toHaveLength(0);
  });
});
