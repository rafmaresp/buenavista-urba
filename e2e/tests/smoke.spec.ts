import { expect, test } from '@playwright/test';

// Humo de la plataforma: la web carga y la API responde detrás de la misma URL.
// Cada funcionalidad con interfaz añade su propio fichero en e2e/tests/.

test('la página principal carga', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Buenavista I · Incidencias');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Buenavista I · Incidencias');
  await page.screenshot({ path: testInfo.outputPath('inicio.png'), fullPage: true });
});

test('la API responde en /api/health', async ({ request }) => {
  const respuesta = await request.get('/api/health');
  expect(respuesta.status()).toBe(200);
  expect(respuesta.headers()['cache-control']).toBe('no-store');
  expect(await respuesta.json()).toEqual({ estado: 'ok' });
});
