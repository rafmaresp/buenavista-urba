# Design — scaffold-plataforma

## Context

- Stack cerrado: Angular + Leaflet · Azure Functions Node 22/TS · Table Storage · SWA Free · login Google validado en Function. Coste 0–1 €/mes. Producto en [`openspec/project.md`](../../project.md).
- `main` ya tiene `data/farolas_buenavista.csv` y `.kml` (no hay que rescatarlos) y los workflows `pc-*` del squad, que se mantienen.
- `quality.config.json` declara `appPaths: ["src/"]`, que no coincide con la estructura `web/` + `api/`: el spec gate no vería el código.

## Goals / Non-Goals

**Goals**: repo compilable, probado y desplegable a 0 €; CI que impida romper build o tests; la cadena SWA + Functions `node:22` validada de punta a punta.

**Non-Goals**: cualquier funcionalidad de producto (ver "Out of scope" en `proposal.md`).

## Decisions

### D1. PR #1: cerrar sin fusionar y empezar limpio (pendiente de aprobación de Rafa)

| Opción | A favor | En contra |
|---|---|---|
| A. Recortar el PR #1 | Conserva la conversación | Borrar ~80 % del diff y reescribir historia (incluye la etapa .NET y el login) |
| **B. Cerrar y rama nueva desde `main`** | Diff pequeño ligado 1:1 a esta propuesta; lockfiles y tests desde el primer commit | Se pierde el hilo (se enlaza en un comentario) |
| C. Fusionar tal cual | Lo más rápido | Mete login y admin sin spec ni tests; supuestos ya descartados (JSON estático, wa.me) |

**B.** La rama `claude/scaffold-inicial` se conserva como borrador para los cambios 2–7. De ella se reutilizan en este cambio solo `staticwebapp.config.json`, `ci.yml`/`azure-swa.yml` (adaptados) y `api/host.json`.

### D2. Web mínima sin Leaflet

Una sola página estática generada por Angular. Leaflet y las teselas entran en `mapa-farolas`, junto con la ampliación de la CSP. Trade-off: el primer despliegue no muestra nada útil al vecino, pero el PR es pequeño y la CSP de partida es la más restrictiva posible.

### D3. API con solo `GET /api/health`

`@azure/functions` v4 (modelo por código, sin `function.json`), TS estricto, salida a `dist/`. `health` responde `200 {"estado":"ok"}` con `Cache-Control: no-store`, anónimo, sin tocar almacenamiento ni revelar versión. Valida la cadena completa (build, `apiRuntime: node:22`, enrutado `/api/*`). `host.json` **sin** Application Insights (sería un recurso más que consultar). Se versiona `local.settings.sample.json`, nunca `local.settings.json`.

### D4. Tests

Vitest en `web/` (runner por defecto de Angular vía `@angular/build:unit-test`) y en `api/`. Trade-off: sin navegador real; suficiente para una página estática y un endpoint. E2E fuera hasta que haya flujo de incidencias.

### D5. CI y despliegue

- `ci.yml`: jobs `web` y `api` en `pull_request` y `push` a `main`; Node 22 con caché npm; `npm ci`, `npm run build`, `npm test`; `permissions: contents: read`. El job `datos` (validación del CSV) llega con `catalogo-farolas`.
- `azure-swa.yml`: `Azure/static-web-apps-deploy@v1`, `app_location: web`, `api_location: api`, `output_location` según el build real de Angular. Despliega en push a `main`; sin `AZURE_STATIC_WEB_APPS_API_TOKEN` termina en verde con aviso.
- **Previews por PR**: SWA Free admite 3 entornos de staging gratis. Propuesta: activarlos con job de cierre. Trade-off: URLs públicas (aceptable mientras no haya datos personales; se revisa en `login-roles`). Pregunta abierta.
- `staticwebapp.config.json`: `platform.apiRuntime: node:22`, `navigationFallback` a `index.html` excluyendo estáticos, cabeceras `Content-Security-Policy` (`default-src 'self'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

### D6. `quality.config.json`

`appPaths: ["web/src/", "api/src/"]`. Sin esto, el spec gate de `pc-quality-gates` no detecta cambios de código y la regla "todo PR de código toca una spec" queda sin efecto. No se baja ningún umbral.

## Risks / Trade-offs

- **Arranque en frío** de la API gestionada → irrelevante: la página no depende de la API.
- **Previews públicas** → sin datos personales en este cambio.
- **Major de Angular durante el proyecto** → lockfile; Dependabot fuera de este cambio.

## Migration Plan

1. Rafa aprueba esta propuesta y la opción B del PR #1.
2. Rama `feat/scaffold-plataforma` desde `main`; un único PR que referencia este cambio.
3. Se cierra el PR #1 con comentario enlazando el nuevo; la rama se conserva.
4. Tras fusionar y verificar `GET /api/health` en la SWA, se archiva el cambio.

Rollback: revertir el PR; no hay datos ni recursos con estado.

## Open Questions

1. ¿Previews por PR en SWA Free (URLs públicas, máx. 3)?
2. ¿Crea Rafa ya el recurso SWA Free (Europa Occidental) y el secreto, o este PR se limita a CI?
