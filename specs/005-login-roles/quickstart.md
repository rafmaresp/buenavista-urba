# Quickstart: Login con Google y roles

## Pruebas automáticas
1. `cd api && npm ci && npm run build && npm test` (con `TABLES_CONNECTION`, `TABLES_ACCOUNT_NAME` y `TABLES_ACCOUNT_KEY` de Azurite se ejecuta también `usuarios.integration.test.ts`).
2. `cd web && npm ci && npm run build && npm test`.
3. `cd e2e && npm ci && npx playwright install chromium && npm test`: `/login` muestra la cláusula antes del botón, `/privacidad` no carga nada de Google y `GET /api/yo` sin token da 401.

## Prueba manual en Azure (tras fusionar)
Requisitos: cliente OAuth de Google creado por Rafa con el origen de la SWA, `googleClientId` en `infra/main.bicepparam` y despliegue de infra aprobado; un usuario en `Usuarios` (llegará con el cambio de alta de usuarios).
1. Abrir `/login`, leer la cláusula, pulsar el botón y elegir la cuenta.
2. Esperado: "Has entrado como directiva". Una cuenta fuera de la lista ve "No tienes acceso".
