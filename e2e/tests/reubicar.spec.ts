import { type Page, expect, test } from '@playwright/test';
import { entrarComoDirectiva, simularApiFarolas, simularApiIncidencias, teselasSinRed } from './farolas.fixture';

// Reubicar farola (specs/008-reubicar-farola). La sesión de directiva y el PUT se simulan (los
// usuarios de prueba con sesión siguen pendientes de diseño); la API real la cubren api/ y Azurite.

test.beforeEach(async ({ page }) => {
  await teselasSinRed(page);
  await simularApiFarolas(page);
  await simularApiIncidencias(page);
});

/** Posición de F07 respecto a F01 (el mapa se desplaza al abrir la ficha; la diferencia no). */
async function posicionRelativaF07(page: Page) {
  const f07 = (await page.getByTitle('Farola F07').boundingBox())!;
  const f01 = (await page.getByTitle('Farola F01').boundingBox())!;
  return { x: f07.x - f01.x, y: f07.y - f01.y };
}

/** Abre la ficha de F07, pulsa "Mover farola" y arrastra la marca 60 px a la derecha y 40 abajo. */
async function moverF07(page: Page) {
  await page.getByTitle('Farola F07').click();
  await page.locator('.leaflet-popup-content').getByRole('button', { name: 'Mover farola' }).click();
  await expect(page.getByRole('group', { name: 'Mover farola' })).toContainText('Arrastra F07 a su sitio.');

  const antes = await posicionRelativaF07(page);
  const marca = page.getByTitle('Farola F07');
  const caja = (await marca.boundingBox())!;
  const x = caja.x + caja.width / 2;
  const y = caja.y + caja.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 30, y + 20, { steps: 5 });
  await page.mouse.move(x + 60, y + 40, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('group', { name: 'Mover farola' })).toContainText('¿Mover F07 aquí?');
  return { antes, destino: { x: x + 60, y: y + 40 } };
}

test('la directiva arrastra una farola, confirma y se guarda con PUT (US1)', async ({ page }, testInfo) => {
  const peticiones: { body: { lat: number; lon: number }; token: string | null }[] = [];
  await page.route('**/api/farolas/F07', async (ruta) => {
    const peticion = ruta.request();
    if (peticion.method() !== 'PUT') return ruta.fallback();
    const body = peticion.postDataJSON() as { lat: number; lon: number };
    peticiones.push({ body, token: await peticion.headerValue('x-id-token') });
    return ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ farola: { id: 'F07', calle: 'C. Prueba', lat: body.lat, lon: body.lon } }),
    });
  });
  await entrarComoDirectiva(page);
  await expect(page.locator('.farola-marca')).toHaveCount(70);

  const { destino } = await moverF07(page);
  await page.screenshot({ path: testInfo.outputPath('confirmar.png') });
  expect(peticiones).toEqual([]);

  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('status')).toContainText('F07 se ha movido.');

  expect(peticiones).toHaveLength(1);
  expect(peticiones[0]!.token).toBe('token-de-prueba');
  expect(Object.keys(peticiones[0]!.body).sort()).toEqual(['lat', 'lon']);
  const caja = (await page.getByTitle('Farola F07').boundingBox())!;
  expect(Math.abs(caja.x + caja.width / 2 - destino.x)).toBeLessThan(3);
  expect(Math.abs(caja.y + caja.height / 2 - destino.y)).toBeLessThan(3);
});

test('Cancelar devuelve la farola a su sitio sin enviar nada (US2)', async ({ page }) => {
  let puts = 0;
  await page.route('**/api/farolas/F07', (ruta) => {
    puts++;
    return ruta.fulfill({ status: 500, body: '{}' });
  });
  await entrarComoDirectiva(page);

  const { antes } = await moverF07(page);
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await expect(page.getByRole('group', { name: 'Mover farola' })).toHaveCount(0);
  const despues = await posicionRelativaF07(page);
  expect(despues.x).toBeCloseTo(antes.x, 0);
  expect(despues.y).toBeCloseTo(antes.y, 0);
  expect(puts).toBe(0);
});

test('si el servidor rechaza, la farola vuelve y se explica (US2)', async ({ page }) => {
  await page.route('**/api/farolas/F07', (ruta) =>
    ruta.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'farola-cambiada' }) }),
  );
  await entrarComoDirectiva(page);

  const { antes } = await moverF07(page);
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByRole('alert')).toContainText('Otra persona ha movido esta farola');
  const despues = await posicionRelativaF07(page);
  expect(despues.x).toBeCloseTo(antes.x, 0);
  expect(despues.y).toBeCloseTo(antes.y, 0);
});

test('sin sesión no se ofrece mover farolas (US3)', async ({ page }) => {
  await page.goto('/');
  await page.getByTitle('Farola F07').click();
  await expect(page.locator('.leaflet-popup-content .ficha')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mover farola' })).toHaveCount(0);
});

test('la API real exige identidad para reubicar (US3)', async ({ request }) => {
  const r = await request.put('/api/farolas/F07', { data: { lat: 37.3165, lon: -5.9606 } });
  expect(r.status()).toBe(401);
  expect(await r.json()).toEqual({ error: 'no-autenticado' });
});
