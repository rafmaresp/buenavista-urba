import { ErrorAviso, ErrorIncidencias, FetchFn, LlamarFn, cargarIncidencias, reportarIncidencia } from './incidencias-cliente';

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
