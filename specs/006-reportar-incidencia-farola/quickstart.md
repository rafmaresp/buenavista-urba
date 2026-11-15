# Quickstart: Reportar y ver incidencias de farolas

## Pruebas automáticas

1. `cd api && npm ci && npm run build && npm test`. Con Azurite (`TABLES_CONNECTION`, `TABLES_ACCOUNT_NAME`, `TABLES_ACCOUNT_KEY`) corre también `incidencias.integration.test.ts`: alta con el SAS `rad`, dos avisos simultáneos dejan una sola incidencia, la auditoría no lleva el comentario y el SAS no permite actualizar.
2. `cd web && npm ci && npm run build && npm test`.
3. `cd e2e && npm ci && npx playwright install chromium && npm test`: con incidencias simuladas, la farola marcada y su ficha con estado y fecha; sin sesión, enlace para entrar; `POST /api/incidencias` sin token da 401.

Contrato en [contracts/api.md](contracts/api.md); modelo en [data-model.md](data-model.md).

## Prueba manual en Azure (tras fusionar y aprobar el despliegue de infra)

Requiere un usuario en `Usuarios` (llega con gestión de usuarios). Solo datos de prueba mientras la SWA esté fuera de la UE.

1. Entrar, tocar una farola sin marca, escribir un comentario y pulsar "Avisar: farola fundida".
2. Esperado: la ficha dice "Incidencia abierta: Nuevo" y la marca cambia. Al recargar sin sesión, la farola sigue marcada.
3. Repetir sobre la misma farola desde otra cuenta: muestra la incidencia existente, no crea otra.
