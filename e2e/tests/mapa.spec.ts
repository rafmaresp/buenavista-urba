import { expect, test } from '@playwright/test';
import { farolasDeLaSemilla, simularApiFarolas, simularApiIncidencias, teselasSinRed } from './farolas.fixture';

// Mapa de farolas en solo lectura (specs/004-mapa-farolas).

test.beforeEach(async ({ page }) => {
  await teselasSinRed(page);
  await simularApiIncidencias(page);
});

test('muestra las 70 farolas sobre el mapa sin iniciar sesión (US1)', async ({ page }, testInfo) => {
  const erroresConsola: string[] = [];
  page.on('console', (m) => m.type() === 'error' && erroresConsola.push(m.text()));
  await simularApiFarolas(page);

  await page.goto('/');

  await expect(page.getByRole('region', { name: 'Mapa de farolas' })).toBeVisible();
  await expect(page.locator('.farola-marca')).toHaveCount(70);
  await expect(page.getByTitle('Farola F01')).toBeVisible();
  await expect(page.getByTitle('Farola F70')).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('mapa.png') });
  // La CSP de staticwebapp.config.json no bloquea ni estilos ni scripts del mapa.
  expect(erroresConsola.filter((t) => /Content Security Policy/i.test(t))).toEqual([]);
});

test('al tocar una farola se abre su ficha con código y calle (US2)', async ({ page }, testInfo) => {
  await simularApiFarolas(page);
  const [f01, f40] = [farolasDeLaSemilla()[0]!, farolasDeLaSemilla()[39]!];
  await page.goto('/');

  await page.getByTitle('Farola F01').click();
  const ficha = page.locator('.leaflet-popup-content .ficha');
  await expect(ficha.getByRole('heading')).toHaveText('F01');
  await expect(ficha).toContainText(f01.calle);
  await page.screenshot({ path: testInfo.outputPath('ficha.png') });

  await page.getByTitle(`Farola ${f40.id}`).click();
  // La ficha anterior se cierra (con su animación): al final solo queda una.
  await expect(ficha).toHaveCount(1);
  await expect(ficha.getByRole('heading')).toHaveText(f40.id);
  await expect(ficha).toContainText(f40.calle);
});

test('cambia entre Ortofoto y Callejero con su atribución (US3)', async ({ page }) => {
  await simularApiFarolas(page);
  await page.goto('/');

  const atribucion = page.locator('.leaflet-control-attribution');
  await expect(page.getByRole('radio', { name: 'Ortofoto' })).toBeChecked();
  await expect(atribucion).toContainText('PNOA © IGN');

  await page.getByRole('radio', { name: 'Callejero' }).check();
  await expect(atribucion).toContainText('© OpenStreetMap');
  await expect(atribucion).not.toContainText('PNOA');
});

test('si el catálogo falla avisa y permite reintentar (US4)', async ({ page }, testInfo) => {
  await simularApiFarolas(page, { status: 500, body: { error: 'No se pudo cargar el catálogo de farolas' } });
  await page.goto('/');

  const aviso = page.getByRole('alert');
  await expect(aviso).toContainText('No se pudieron cargar las farolas');
  await expect(page.locator('.farola-marca')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('error.png') });

  await page.unroute('**/api/farolas');
  await simularApiFarolas(page);
  await aviso.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.locator('.farola-marca')).toHaveCount(70);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
