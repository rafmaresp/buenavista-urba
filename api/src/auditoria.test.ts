import { describe, expect, it, vi } from 'vitest';
import {
  AuditoriaInvalida,
  type EntidadAuditoria,
  type EntradaAuditoria,
  actorValido,
  auditar,
  entidadDeAuditoria,
} from './auditoria';

const alta: EntradaAuditoria = {
  actor: 'sistema:carga',
  accion: 'farola.alta',
  entidad: 'Farolas',
  clave: 'F07',
  antes: null,
  despues: { calle: 'C. M', lat: 37.31, lon: -5.96, precision: 'estimada' },
};

describe('auditar()', () => {
  it.each(['sistema:carga', 'dev:rafa', '3f2b8c1e-9d4a-4b7e-8f10-2a6c5d7e9b01'])('acepta el actor %s', (actor) => {
    expect(actorValido(actor)).toBe(true);
  });

  it.each(['vecino@example.com', 'rafa', 'sistema:', 'dev:Rafa', 'sistema:carga@example.com', '1234567890'])(
    'rechaza el actor %s',
    (actor) => {
      expect(() => entidadDeAuditoria({ ...alta, actor })).toThrow(AuditoriaInvalida);
    },
  );

  it('agrupa por mes UTC (AAAA-MM), también en el cambio de mes', () => {
    // 1 de diciembre a las 00:30 en Madrid sigue siendo noviembre en UTC.
    const entidad = entidadDeAuditoria(alta, new Date('2026-11-30T23:30:00Z'));
    expect(entidad.partitionKey).toBe('2026-11');
    expect(entidad.cuando).toBe('2026-11-30T23:30:00.000Z');
    expect(entidad.rowKey).toMatch(/^2026-11-30T23:30:00\.000Z_[0-9a-f-]{36}$/);
  });

  it('guarda quién, qué, cuándo, antes y después', () => {
    const entidad = entidadDeAuditoria(alta, new Date('2026-11-15T09:00:00Z'));
    expect(entidad).toMatchObject({
      actor: 'sistema:carga',
      accion: 'farola.alta',
      entidad: 'Farolas',
      clave: 'F07',
      antes: '',
    });
    expect(JSON.parse(entidad.despues)).toEqual(alta.despues);
  });

  it('dos entradas en el mismo instante no comparten RowKey', () => {
    const ahora = new Date();
    expect(entidadDeAuditoria(alta, ahora).rowKey).not.toBe(entidadDeAuditoria(alta, ahora).rowKey);
  });

  it.each(['email', 'Email', 'correo', 'sub', 'nombre', 'name', 'comentario'])(
    'rechaza el campo prohibido %s, también anidado',
    (campo) => {
      expect(() => entidadDeAuditoria({ ...alta, despues: { [campo]: 'x' } })).toThrow(/campo prohibido/);
      expect(() => entidadDeAuditoria({ ...alta, antes: { autor: { [campo]: 'x' } } })).toThrow(/campo prohibido/);
    },
  );

  it('rechaza cualquier valor con forma de email, aunque la clave sea inocente', () => {
    expect(() => entidadDeAuditoria({ ...alta, despues: { contacto: 'vecino@example.com' } })).toThrow(
      /forma de email/,
    );
    expect(() => entidadDeAuditoria({ ...alta, despues: { lista: ['ok', 'otro@example.com'] } })).toThrow(
      /forma de email/,
    );
  });

  it('rechaza una acción, entidad o clave mal formadas, y una entrada sin antes ni después', () => {
    expect(() => entidadDeAuditoria({ ...alta, accion: 'alta' })).toThrow(AuditoriaInvalida);
    expect(() => entidadDeAuditoria({ ...alta, entidad: 'farolas' })).toThrow(AuditoriaInvalida);
    expect(() => entidadDeAuditoria({ ...alta, clave: '' })).toThrow(AuditoriaInvalida);
    expect(() => entidadDeAuditoria({ ...alta, despues: null })).toThrow(AuditoriaInvalida);
  });

  it('inserta la entrada con createEntity (nunca upsert ni update)', async () => {
    const createEntity = vi.fn<(e: EntidadAuditoria) => Promise<unknown>>().mockResolvedValue({});
    await auditar({ createEntity }, entidadDeAuditoria(alta));
    expect(createEntity).toHaveBeenCalledOnce();
    expect(createEntity.mock.calls[0]![0].clave).toBe('F07');
  });
});
