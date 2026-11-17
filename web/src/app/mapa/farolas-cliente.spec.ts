import { ErrorCargaFarolas, ErrorReubicar, FetchFn, LlamarFn, cargarFarolas, reubicarFarola } from './farolas-cliente';

const F01 = { id: 'F01', calle: 'C. M (paralela A-8032)', lat: 37.3186864, lon: -5.961454 };

function respuesta(cuerpo: unknown, ok = true): FetchFn {
  return async () => ({ ok, json: async () => cuerpo });
}

describe('cargarFarolas (GET /api/farolas)', () => {
  it('pide /api/farolas y devuelve las farolas válidas', async () => {
    const urls: string[] = [];
    const farolas = await cargarFarolas(async (url) => {
      urls.push(url);
      return { ok: true, json: async () => ({ farolas: [F01] }) };
    });
    expect(urls).toEqual(['/api/farolas']);
    expect(farolas).toEqual([F01]);
  });

  it('se queda solo con id, calle, lat y lon aunque la API mande más campos', async () => {
    const [farola] = await cargarFarolas(respuesta({ farolas: [{ ...F01, precision: 'estimada' }] }));
    expect(Object.keys(farola!).sort()).toEqual(['calle', 'id', 'lat', 'lon']);
  });

  it('un catálogo vacío no es un error', async () => {
    await expect(cargarFarolas(respuesta({ farolas: [] }))).resolves.toEqual([]);
  });

  it('falla si la API responde con error (FR-006)', async () => {
    await expect(cargarFarolas(respuesta({ error: 'x' }, false))).rejects.toBeInstanceOf(ErrorCargaFarolas);
  });

  it('falla si no hay conexión', async () => {
    await expect(cargarFarolas(() => Promise.reject(new TypeError('Failed to fetch')))).rejects.toBeInstanceOf(
      ErrorCargaFarolas,
    );
  });

  it('falla si el cuerpo no es JSON', async () => {
    const fetchFn: FetchFn = async () => ({ ok: true, json: () => Promise.reject(new SyntaxError('x')) });
    await expect(cargarFarolas(fetchFn)).rejects.toBeInstanceOf(ErrorCargaFarolas);
  });

  it.each([
    ['sin lista de farolas', {}],
    ['cuerpo nulo', null],
    ['farolas no es una lista', { farolas: 'F01' }],
    ['id con otro formato', { farolas: [{ ...F01, id: 'F1' }] }],
    ['calle vacía', { farolas: [{ ...F01, calle: '  ' }] }],
    ['latitud no numérica', { farolas: [{ ...F01, lat: '37.3' }] }],
    ['longitud no finita', { farolas: [{ ...F01, lon: Number.NaN }] }],
    ['elemento nulo', { farolas: [null] }],
  ])('falla con un catálogo malformado: %s', async (_caso, cuerpo) => {
    await expect(cargarFarolas(respuesta(cuerpo))).rejects.toBeInstanceOf(ErrorCargaFarolas);
  });
});

describe('reubicarFarola (PUT /api/farolas/{id})', () => {
  function llamada(status: number, cuerpo: unknown = {}) {
    const llamadas: [string, RequestInit][] = [];
    const llamar: LlamarFn = async (url, init) => {
      llamadas.push([url, init]);
      return { ok: status < 300, status, json: async () => cuerpo };
    };
    return { llamar, llamadas };
  }

  it('envía PUT con lat y lon en JSON y devuelve la farola movida', async () => {
    const movida = { ...F01, lat: 37.3187, lon: -5.9615 };
    const { llamar, llamadas } = llamada(200, { farola: { ...movida, precision: 'verificada' } });
    expect(await reubicarFarola(llamar, 'F01', 37.3187, -5.9615)).toEqual(movida);
    const [url, init] = llamadas[0]!;
    expect(url).toBe('/api/farolas/F01');
    expect(init.method).toBe('PUT');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ lat: 37.3187, lon: -5.9615 });
  });

  it.each([
    [401, 'sin-sesion'],
    [403, 'sin-sesion'],
    [409, 'cambiada'],
    [400, 'no-valido'],
    [404, 'no-valido'],
    [429, 'no-disponible'],
    [503, 'no-disponible'],
  ])('%i → %s', async (status, motivo) => {
    const { llamar } = llamada(status);
    await expect(reubicarFarola(llamar, 'F01', 37.31, -5.96)).rejects.toMatchObject({ motivo });
  });

  it('sin conexión o respuesta rara → no-disponible', async () => {
    await expect(reubicarFarola(async () => Promise.reject(new TypeError('red')), 'F01', 37.31, -5.96)).rejects.toBeInstanceOf(
      ErrorReubicar,
    );
    const { llamar } = llamada(200, { farola: { id: 'F01' } });
    await expect(reubicarFarola(llamar, 'F01', 37.31, -5.96)).rejects.toMatchObject({ motivo: 'no-disponible' });
  });
});
