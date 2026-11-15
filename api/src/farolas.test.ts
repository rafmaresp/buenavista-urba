import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { type ClienteLecturaFarolas, SemillaInvalida, parsearSemilla, respuestaFarolas, validarReubicacion } from './farolas';

const semillaReal = readFileSync(join(__dirname, '..', '..', 'data', 'farolas_buenavista.csv'), 'utf8');
const CABECERA = 'farola,calle,lat,lon,posicion';

/** Semilla válida de 70 farolas con una línea cambiada. */
function semillaCon(cambio?: (lineas: string[]) => void): string {
  const lineas = [CABECERA];
  for (let n = 1; n <= 70; n++) lineas.push(`${n},C. Prueba,37.315,-5.961,estimada`);
  cambio?.(lineas);
  return lineas.join('\n');
}

describe('semilla de farolas', () => {
  it('la semilla del repo tiene las 70 farolas F01–F70 sin huecos, F62 incluida como una más', () => {
    const farolas = parsearSemilla(semillaReal);
    expect(farolas.map((f) => f.id)).toEqual(Array.from({ length: 70 }, (_, k) => `F${String(k + 1).padStart(2, '0')}`));
    expect(farolas.find((f) => f.id === 'F62')).toEqual({
      id: 'F62',
      calle: 'C. H / C. Q',
      lat: 37.3154785,
      lon: -5.9617603,
      precision: 'estimada',
    });
  });

  it('lee solo las farolas: se detiene en la línea en blanco antes de los tramos', () => {
    expect(parsearSemilla(semillaCon((l) => l.push('', 'calle,desde,hasta,distancia_m', 'C. M,1,2,40.0')))).toHaveLength(70);
  });

  it('admite finales de línea de Windows', () => {
    expect(parsearSemilla(semillaCon().replace(/\n/g, '\r\n'))).toHaveLength(70);
  });

  it.each([
    ['cabecera distinta', (l: string[]) => (l[0] = 'id,calle,lat,lon,posicion'), /línea 1: la cabecera/],
    ['farola repetida', (l: string[]) => (l[2] = '1,C. Prueba,37.315,-5.961,estimada'), /línea 3: F01 repetida/],
    ['farola fuera de 1–70', (l: string[]) => (l[70] = '71,C. Prueba,37.315,-5.961,estimada'), /línea 71: farola "71"/],
    ['latitud no numérica', (l: string[]) => (l[5] = '5,C. Prueba,abc,-5.961,estimada'), /línea 6: F05: latitud/],
    ['latitud fuera de la urbanización', (l: string[]) => (l[5] = '5,C. Prueba,40.4,-5.961,estimada'), /F05: latitud/],
    ['longitud fuera de la urbanización', (l: string[]) => (l[5] = '5,C. Prueba,37.315,-3.7,estimada'), /F05: longitud/],
    ['posición desconocida', (l: string[]) => (l[5] = '5,C. Prueba,37.315,-5.961,inferida'), /F05: posicion "inferida"/],
    ['comillas', (l: string[]) => (l[5] = '5,"C. Prueba, 2",37.315,-5.961,estimada'), /línea 6: no se admiten comillas/],
    ['calle vacía', (l: string[]) => (l[5] = '5,,37.315,-5.961,estimada'), /F05 sin calle/],
    ['falta una farola', (l: string[]) => l.splice(62, 1), /hay 69 farolas, faltan F62/],
  ])('rechaza la semilla entera si hay %s', (_caso, cambio, mensaje) => {
    expect(() => parsearSemilla(semillaCon(cambio))).toThrow(SemillaInvalida);
    expect(() => parsearSemilla(semillaCon(cambio))).toThrow(mensaje);
  });
});

function clienteCon(entidades: object[]): ClienteLecturaFarolas & { listEntities: ReturnType<typeof vi.fn> } {
  return {
    listEntities: vi.fn(() =>
      (async function* () {
        yield* entidades;
      })(),
    ),
  } as never;
}

describe('GET /api/farolas', () => {
  const tabla = [
    { partitionKey: 'farola', rowKey: 'F02', calle: 'C. M', lat: 37.2, lon: -5.9, precision: 'estimada', etag: 'x', timestamp: 't' },
    { partitionKey: 'farola', rowKey: 'F01', calle: 'C. M', lat: 37.1, lon: -5.8, precision: 'verificada', etag: 'y', timestamp: 't' },
  ];

  it('devuelve id, calle, lat y lon ordenadas por id, y nada más (ni precisión ni campos de la tabla)', async () => {
    const res = await respuestaFarolas(() => clienteCon(tabla));
    expect(res.status).toBe(200);
    const { farolas } = res.jsonBody as { farolas: Record<string, unknown>[] };
    expect(farolas.map((f) => f.id)).toEqual(['F01', 'F02']);
    for (const f of farolas) expect(Object.keys(f).sort()).toEqual(['calle', 'id', 'lat', 'lon']);
    expect(JSON.stringify(res.jsonBody)).not.toMatch(/precision|verificada|estimada/);
  });

  it('ni siquiera pide la precisión a la tabla', async () => {
    const cliente = clienteCon(tabla);
    await respuestaFarolas(() => cliente);
    const select = cliente.listEntities.mock.calls[0]![0].queryOptions.select as string[];
    expect(select).not.toContain('precision');
  });

  it('es cacheable públicamente 5 minutos', async () => {
    const res = await respuestaFarolas(() => clienteCon(tabla));
    expect(res.headers['Cache-Control']).toBe('public, max-age=300');
  });

  it('con el catálogo sin sembrar devuelve una lista vacía', async () => {
    const res = await respuestaFarolas(() => clienteCon([]));
    expect(res).toMatchObject({ status: 200, jsonBody: { farolas: [] } });
  });

  it('si el almacenamiento falla: 500 genérico, sin caché y sin detalles internos en la respuesta ni en el log', async () => {
    const error = Object.assign(new Error('https://cuenta.table.core.windows.net/Farolas()?sig=SECRETO'), {
      name: 'RestError',
      statusCode: 403,
    });
    const registrar = vi.fn();
    const res = await respuestaFarolas(
      () => ({
        listEntities: () =>
          (async function* () {
            throw error;
          })(),
      }),
      registrar,
    );
    expect(res).toEqual({
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
      jsonBody: { error: 'No se pudo cargar el catálogo de farolas' },
    });
    expect(registrar).toHaveBeenCalledWith('GET /api/farolas falló: RestError 403');
    expect(JSON.stringify(registrar.mock.calls)).not.toContain('SECRETO');
  });

  it('si falta la configuración también responde 500 sin caché', async () => {
    const res = await respuestaFarolas(() => {
      throw new Error('Falta el app setting FAROLAS_CONNECTION');
    });
    expect(res.status).toBe(500);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
});

describe('validarReubicacion (cuerpo de PUT /api/farolas/{id})', () => {
  it('acepta lat y lon dentro de la urbanización e ignora el resto de campos', () => {
    expect(validarReubicacion({ lat: 37.3165, lon: -5.9606, calle: 'Otra', precision: 'estimada' })).toEqual({
      lat: 37.3165,
      lon: -5.9606,
    });
  });

  it('acepta los bordes del recuadro', () => {
    expect(validarReubicacion({ lat: 37.3, lon: -5.95 })).toEqual({ lat: 37.3, lon: -5.95 });
    expect(validarReubicacion({ lat: 37.33, lon: -5.98 })).toEqual({ lat: 37.33, lon: -5.98 });
  });

  it.each([
    ['nulo', null],
    ['texto', 'F07'],
    ['lista', [37.31, -5.96]],
    ['sin lon', { lat: 37.31 }],
    ['lat como texto', { lat: '37.31', lon: -5.96 }],
    ['lat NaN', { lat: Number.NaN, lon: -5.96 }],
    ['lon infinita', { lat: 37.31, lon: Number.POSITIVE_INFINITY }],
    ['lat fuera (norte)', { lat: 37.331, lon: -5.96 }],
    ['lat fuera (sur)', { lat: 37.29, lon: -5.96 }],
    ['lon fuera (este)', { lat: 37.31, lon: -5.94 }],
    ['lon fuera (oeste)', { lat: 37.31, lon: -5.99 }],
  ])('rechaza %s', (_caso, cuerpo) => {
    expect(validarReubicacion(cuerpo)).toBeUndefined();
  });
});
