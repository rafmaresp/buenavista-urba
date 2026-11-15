import { defineConfig, devices } from '@playwright/test';

/**
 * e2e contra la CLI de SWA (`swa start`), que sirve la web compilada y arranca la API
 * con Azure Functions Core Tools, igual que en producción: misma ruta /api, mismo
 * staticwebapp.config.json. Requiere `npm run build` previo en web/ y api/.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4280',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // --swa-config-location: sin él la CLI busca staticwebapp.config.json en e2e/ y no aplica ni el
    // navigationFallback (rutas como /login dan 404) ni las cabeceras (CSP) de producción.
    command: 'swa start ../web/dist/web/browser --api-location ../api --swa-config-location ../web/public --port 4280',
    url: 'http://localhost:4280/api/health',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
