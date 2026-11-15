import { expect, test } from '@playwright/test';
import { simularApiFarolas, simularApiIncidencias, teselasSinRed } from './farolas.fixture';

// Incidencias de farolas (specs/006-reportar-incidencia-farola). Sin usuarios de prueba con sesión
// (pendientes de diseño): se prueba la vista sin sesión con incidencias simuladas y que la API real
// exige identidad para avisar. El alta con identidad la cubren api/ (unitarias y Azurite).

test.beforeEach(async ({ page }) => {
  await teselasSinRed(page);
  await simularApiFarolas(page);
});

test('sin sesión se ven las farolas con incidencia abierta y su estado (US3)', async ({ page }, testInfo) => {
  await simularApiIncidencias(page, [{ id: 'a1', farola: 'F07', estado: 'Nuevo', creada: '2026-11-15T19:30:00.000Z' }]);
  await page.goto('/');

  await expect(page.locator('.farola-marca')).toHaveCount(70);
  await expect(page.locator('.farola-marca--incidencia')).toHaveCount(1);
  await expect(page.locator('.farola-marca--incidencia')).toHaveAttribute('title', 'Farola F07');

  await page.getByTitle('Farola F07').click();
  const ficha = page.locator('.leaflet-popup-content .ficha');
  await expect(ficha).toContainText('Incidencia abierta: Nuevo, avisada el 15/11/2026');
  await expect(ficha.locator('form')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('incidencia.png') });
});

test('sin sesión, la ficha de una farola sin incidencia invita a entrar (US1)', async ({ page }) => {
  await simularApiIncidencias(page);
  await page.goto('/');

  await page.getByTitle('Farola F01').click();
  const enlace = page.locator('.leaflet-popup-content').getByRole('link', { name: 'Entra para avisar de que está fundida' });
  await enlace.click();
  await expect(page).toHaveURL(/\/login$/);
});

test('si fallan las incidencias el mapa sigue y avisa (FR-010)', async ({ page }) => {
  await page.route('**/api/incidencias', (ruta) => ruta.fulfill({ status: 500, body: '{}' }));
  await page.goto('/');

  await expect(page.locator('.farola-marca')).toHaveCount(70);
  await expect(page.getByRole('alert')).toContainText('No se pudieron cargar las incidencias');
});

test('la API real exige identidad para avisar', async ({ request }) => {
  const r = await request.post('/api/incidencias', { data: { farola: 'F07' } });
  expect(r.status()).toBe(401);
  expect(await r.json()).toEqual({ error: 'no-autenticado' });
});

// Cambiar el estado (specs/007-cambiar-estado-incidencia): solo directiva. Sin usuarios de prueba con
// sesión, aquí se prueba que la API real exige identidad y que sin sesión no hay selector; el resto lo
// cubren api/ (unitarias y Azurite) y web/ (ficha con rol directiva).
test('sin sesión la ficha con incidencia no ofrece cambiar el estado', async ({ page }) => {
  await simularApiIncidencias(page, [{ id: 'a1', farola: 'F07', estado: 'Nuevo', creada: '2026-11-15T19:30:00.000Z' }]);
  await page.goto('/');
  await page.getByTitle('Farola F07').click();
  const ficha = page.locator('.leaflet-popup-content .ficha');
  await expect(ficha).toContainText('Incidencia abierta: Nuevo');
  await expect(ficha.locator('select')).toHaveCount(0);
});

test('la API real exige identidad para cambiar el estado', async ({ request }) => {
  const r = await request.put('/api/incidencias/0b9c4f3e-6a1d-4c8e-9f2a-1d3e5b7c9a01', {
    data: { farola: 'F07', estado: 'Recibido' },
  });
  expect(r.status()).toBe(401);
  expect(await r.json()).toEqual({ error: 'no-autenticado' });
});
