import {
  ErrorAviso,
  ErrorCambio,
  ErrorIncidencias,
  FetchFn,
  LlamarFn,
  cambiarEstado,
  cargarIncidencias,
  estadosSiguientes,
  reportarIncidencia,
} from './incidencias-cliente';

const INC = { id: 'a1', farola: 'F07', estado: 'Nuevo', creada: '2026-11-15T19:30:00.000Z' };

function respuesta(cuerpo: unknown, ok = true): FetchFn {
  return async () => ({ ok, json: async () => cuerpo });
}

function llamada(status: number, cuerpo: unknown = {}) {
  const llamadas: [string, RequestInit][] = [];
  const llamar: LlamarFn = async (url, init) => {
    llamadas.push([url, init]);
    return { ok: status < 300, status, json: async () => cuerpo };
  };
  return { llamar, llamadas };
}

describe('cargarIncidencias (GET /api/incidencias)', () => {
  it('devuelve las incidencias solo con los campos públicos', async () => {
    const urls: string[] = [];
    const lista = await cargarIncidencias(async (url) => {
      urls.push(url);
      return { ok: true, json: async () => ({ incidencias: [{ ...INC, autor: 'x', comentario: 'y' }] }) };
    });
    expect(urls).toEqual(['/api/incidencias']);
    expect(lista).toEqual([INC]);
  });

  it.each([
    ['error HTTP', respuesta({}, false)],
    ['sin lista', respuesta({})],
    ['farola mal formada', respuesta({ incidencias: [{ ...INC, farola: 'X' }] })],
    ['fecha no válida', respuesta({ incidencias: [{ ...INC, creada: 'ayer' }] })],
    ['no JSON', async () => ({ ok: true, json: async () => Promise.reject(new SyntaxError('x')) })],
    ['sin conexión', async () => Promise.reject(new TypeError('red'))],
  ] as [string, FetchFn][])('falla con %s', async (_, fetchFn) => {
    await expect(cargarIncidencias(fetchFn)).rejects.toBeInstanceOf(ErrorIncidencias);
  });
});

describe('reportarIncidencia (POST /api/incidencias)', () => {
  it('envía farola y comentario recortado en JSON y devuelve la creada', async () => {
    const { llamar, llamadas } = llamada(201, { incidencia: INC });
    expect(await reportarIncidencia(llamar, 'F07', '  Parpadea ')).toEqual(INC);
    const [url, init] = llamadas[0]!;
    expect(url).toBe('/api/incidencias');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ farola: 'F07', comentario: 'Parpadea' });
  });

  it('sin comentario no lo envía', async () => {
    const { llamar, llamadas } = llamada(201, { incidencia: INC });
    await reportarIncidencia(llamar, 'F07', '   ');
    expect(JSON.parse(llamadas[0]![1].body as string)).toEqual({ farola: 'F07' });
  });

  it('409: devuelve la incidencia existente', async () => {
    const { llamar } = llamada(409, { error: 'ya-abierta', incidencia: INC });
    expect(await reportarIncidencia(llamar, 'F07', '')).toEqual(INC);
  });

  it.each([
    [401, 'sin-sesion'],
    [403, 'sin-sesion'],
    [400, 'no-valido'],
    [503, 'no-disponible'],
    [429, 'no-disponible'],
  ])('%i → %s', async (status, motivo) => {
    const { llamar } = llamada(status);
    await expect(reportarIncidencia(llamar, 'F07', '')).rejects.toMatchObject({ motivo });
  });

  it('sin conexión o respuesta rara → no-disponible', async () => {
    await expect(reportarIncidencia(async () => Promise.reject(new TypeError('red')), 'F07', '')).rejects.toBeInstanceOf(ErrorAviso);
    const { llamar } = llamada(201, { incidencia: { id: 1 } });
    await expect(reportarIncidencia(llamar, 'F07', '')).rejects.toMatchObject({ motivo: 'no-disponible' });
  });
});

describe('estadosSiguientes', () => {
  it('ofrece solo los estados posteriores', () => {
    expect(estadosSiguientes('Nuevo')).toEqual(['Recibido', 'Profesional notificado', 'Completado']);
    expect(estadosSiguientes('Profesional notificado')).toEqual(['Completado']);
    expect(estadosSiguientes('Completado')).toEqual([]);
    expect(estadosSiguientes('Raro')).toEqual([]);
  });
});

describe('cambiarEstado (PUT /api/incidencias/{id})', () => {
  it('envía farola y estado y devuelve la incidencia pública', async () => {
    const { llamar, llamadas } = llamada(200, { incidencia: { ...INC, estado: 'Recibido', autor: 'x' } });
    expect(await cambiarEstado(llamar, INC, 'Recibido')).toEqual({ ...INC, estado: 'Recibido' });
    expect(llamadas).toHaveLength(1);
    const [url, init] = llamadas[0]!;
    expect(url).toBe('/api/incidencias/a1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({ farola: 'F07', estado: 'Recibido' });
  });

  it.each([
    [401, 'sin-sesion'],
    [403, 'sin-sesion'],
    [404, 'ha-cambiado'],
    [400, 'no-disponible'],
    [503, 'no-disponible'],
  ])('%i → %s', async (status, motivo) => {
    const { llamar } = llamada(status, { error: 'x' });
    await expect(cambiarEstado(llamar, INC, 'Recibido')).rejects.toMatchObject({ motivo });
  });

  it('409 trae la incidencia actual', async () => {
    const { llamar } = llamada(409, { error: 'ha-cambiado', incidencia: { ...INC, estado: 'Completado' } });
    const error = await cambiarEstado(llamar, INC, 'Recibido').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorCambio);
    expect((error as ErrorCambio).motivo).toBe('ha-cambiado');
    expect((error as ErrorCambio).actual).toEqual({ ...INC, estado: 'Completado' });
  });

  it('sin conexión o 200 con cuerpo no válido → no-disponible', async () => {
    await expect(cambiarEstado(async () => Promise.reject(new Error('red')), INC, 'Recibido')).rejects.toMatchObject({
      motivo: 'no-disponible',
    });
    const { llamar } = llamada(200, { incidencia: { id: 'a1' } });
    await expect(cambiarEstado(llamar, INC, 'Recibido')).rejects.toMatchObject({ motivo: 'no-disponible' });
  });
});
