import { type Page, type Route, expect, test } from '@playwright/test';
import { entrarComoDirectiva, simularApiFarolas, simularApiIncidencias, teselasSinRed } from './farolas.fixture';

// Gestión de usuarios (specs/009-gestion-usuarios). La sesión de directiva y /api/usuarios se
// simulan (los usuarios de prueba con sesión siguen pendientes); la API real la cubren api/ y Azurite.

interface Usuario {
  uid: string;
  email: string;
  rol: 'comunero' | 'directiva';
  estado: 'activo' | 'baja';
  vinculado: boolean;
  propio: boolean;
}

test.beforeEach(async ({ page }) => {
  await teselasSinRed(page);
  await simularApiFarolas(page);
  await simularApiIncidencias(page);
});

/** Una /api/usuarios en memoria que aplica POST y PATCH como el contrato, y registra lo que recibe. */
async function simularApiUsuarios(page: Page) {
  const usuarios: Usuario[] = [
    { uid: 'u-ana', email: 'ana@example.com', rol: 'directiva', estado: 'activo', vinculado: true, propio: true },
    { uid: 'u-bea', email: 'bea@example.com', rol: 'comunero', estado: 'activo', vinculado: true, propio: false },
  ];
  const peticiones: { metodo: string; url: string; cuerpo: unknown; token: string | null }[] = [];
  const responder = (ruta: Route, status: number, cuerpo: unknown) =>
    ruta.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) });

  await page.route('**/api/usuarios**', async (ruta) => {
    const peticion = ruta.request();
    const metodo = peticion.method();
    const cuerpo = peticion.postDataJSON() as Record<string, string> | null;
    peticiones.push({ metodo, url: new URL(peticion.url()).pathname, cuerpo, token: await peticion.headerValue('x-id-token') });
    if (metodo === 'GET') return responder(ruta, 200, { usuarios: [...usuarios].sort((a, b) => a.email.localeCompare(b.email)) });
    if (metodo === 'POST') {
      const email = cuerpo!['email']!.trim().toLowerCase();
      if (usuarios.some((u) => u.email === email)) return responder(ruta, 409, { error: 'ya-existe' });
      const nuevo: Usuario = { uid: `u-${usuarios.length}`, email, rol: cuerpo!['rol'] as Usuario['rol'], estado: 'activo', vinculado: false, propio: false };
      usuarios.push(nuevo);
      return responder(ruta, 201, { usuario: nuevo });
    }
    const uid = new URL(peticion.url()).pathname.split('/').pop();
    const usuario = usuarios.find((u) => u.uid === uid)!;
    Object.assign(usuario, cuerpo);
    return responder(ruta, 200, { usuario });
  });
  return peticiones;
}

async function abrirUsuarios(page: Page) {
  await entrarComoDirectiva(page);
  await page.getByRole('link', { name: 'Usuarios' }).click();
  await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible();
}

const fila = (page: Page, email: string) => page.locator('.usuarios__lista li', { hasText: email });

test('la directiva da de alta a un vecino y aparece sin haber entrado aún (US1)', async ({ page }, testInfo) => {
  const peticiones = await simularApiUsuarios(page);
  await abrirUsuarios(page);

  await page.getByLabel('Correo de Google').fill('Carmen@Example.com');
  await page.getByRole('button', { name: 'Dar de alta' }).click();

  await expect(page.getByRole('status')).toContainText('carmen@example.com ya puede entrar como comunero.');
  await expect(fila(page, 'carmen@example.com')).toContainText('aún no ha entrado');
  await page.screenshot({ path: testInfo.outputPath('alta.png') });
  const alta = peticiones.find((p) => p.metodo === 'POST')!;
  expect(alta.cuerpo).toEqual({ email: 'Carmen@Example.com', rol: 'comunero' });
  expect(alta.token).toBe('token-de-prueba');
});

test('un correo que ya está en la lista no se da de alta otra vez (US1)', async ({ page }) => {
  await simularApiUsuarios(page);
  await abrirUsuarios(page);
  await page.getByLabel('Correo de Google').fill('bea@example.com');
  await page.getByRole('button', { name: 'Dar de alta' }).click();
  await expect(page.getByRole('status')).toContainText('Ese correo ya está en la lista');
  await expect(page.locator('.usuarios__lista li')).toHaveCount(2);
});

test('dar de baja y reactivar (US2)', async ({ page }) => {
  const peticiones = await simularApiUsuarios(page);
  await abrirUsuarios(page);

  await fila(page, 'bea@example.com').getByRole('button', { name: 'Dar de baja' }).click();
  await expect(page.getByRole('status')).toContainText('bea@example.com se ha dado de baja.');
  await expect(fila(page, 'bea@example.com')).toContainText('de baja');

  await fila(page, 'bea@example.com').getByRole('button', { name: 'Reactivar' }).click();
  await expect(page.getByRole('status')).toContainText('bea@example.com se ha reactivado.');
  expect(peticiones.filter((p) => p.metodo === 'PATCH').map((p) => [p.url, p.cuerpo])).toEqual([
    ['/api/usuarios/u-bea', { estado: 'baja' }],
    ['/api/usuarios/u-bea', { estado: 'activo' }],
  ]);
});

test('cambiar el rol; la fila propia no tiene controles (US3)', async ({ page }) => {
  await simularApiUsuarios(page);
  await abrirUsuarios(page);

  await expect(fila(page, 'ana@example.com')).toContainText('(tú)');
  await expect(fila(page, 'ana@example.com').locator('button, select')).toHaveCount(0);

  await page.getByLabel('Rol de bea@example.com').selectOption('directiva');
  await expect(page.getByRole('status')).toContainText('bea@example.com ahora es directiva.');
});

test('un comunero no ve el enlace a Usuarios y, si abre la ruta, no se llama a la API', async ({ page }) => {
  const peticiones = await simularApiUsuarios(page);
  await entrarComoDirectiva(page);
  // entrarComoDirectiva simula /api/yo como directiva; aquí se vuelve a entrar como comunero.
  await page.route('**/api/yo', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rol: 'comunero' }) }),
  );
  await page.getByRole('button', { name: 'Salir' }).click();
  await page.getByRole('link', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Entrar (prueba)' }).click();
  await page.getByRole('link', { name: 'Ir al inicio' }).click();
  await expect(page.getByRole('navigation')).toContainText('comunero');
  await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
  expect(peticiones).toEqual([]);
});
