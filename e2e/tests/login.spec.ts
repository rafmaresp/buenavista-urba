import { expect, test } from '@playwright/test';

// Login con Google (spec 005-login-roles). Sin cuenta real de Google: se comprueba la pantalla de
// entrada, que Google no se carga fuera de /login y que la API exige identidad.

test('/login muestra la cláusula antes del botón y enlaza a /privacidad', async ({ page }, testInfo) => {
  await page.goto('/login');
  const clausula = page.getByTestId('clausula');
  await expect(clausula).toContainText('Responsable: Comunidad de Propietarios Buenavista I');
  const boton = page.getByTestId('boton-google');
  await expect(boton).toBeAttached();
  const clausulaAntes = await clausula.evaluate(
    (c, b) => Boolean(c.compareDocumentPosition(b!) & Node.DOCUMENT_POSITION_FOLLOWING),
    await boton.elementHandle(),
  );
  expect(clausulaAntes).toBe(true);
  // En la CI no hay client ID configurado: el login avisa de que no está disponible.
  await expect(page.getByRole('alert')).toContainText('no está disponible');
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });

  await page.getByRole('link', { name: 'Política de privacidad completa' }).click();
  await expect(page).toHaveURL(/\/privacidad$/);
  await expect(page.getByRole('heading', { name: 'Política de privacidad' })).toBeVisible();
});

test('fuera de /login no se pide nada a Google', async ({ page }) => {
  const aGoogle: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('google.com')) aGoogle.push(r.url());
  });
  await page.goto('/');
  await page.goto('/privacidad');
  await expect(page.getByRole('heading', { name: 'Política de privacidad' })).toBeVisible();
  expect(aGoogle).toEqual([]);
});

test('la API exige identidad en /api/yo y publica la configuración', async ({ request }) => {
  const yo = await request.get('/api/yo');
  expect(yo.status()).toBe(401);
  expect(await yo.json()).toEqual({ error: 'no-autenticado' });

  const config = await request.get('/api/config');
  expect(config.status()).toBe(200);
  expect(await config.json()).toHaveProperty('googleClientId');
});
