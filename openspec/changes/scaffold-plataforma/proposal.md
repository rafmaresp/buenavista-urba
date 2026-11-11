# Scaffold de la plataforma: Angular + Azure Functions, CI y despliegue a SWA Free

Primer cambio de la secuencia de [`openspec/roadmap.md`](../../roadmap.md). Sustituye a la propuesta `scaffold-mapa-farolas`, escrita antes de las decisiones de producto del 2026-11-12 (farolas en Table Storage vía API, precisión oculta al comunero) y que mezclaba scaffold, catálogo y mapa.

## Why

Antes de construir catálogo, mapa, login e incidencias hace falta una base pequeña que se pueda revisar, probar y desplegar a 0 €. Hoy `main` no tiene código de aplicación y el README todavía dice ".NET 10", ya descartado. El PR #1 (`claude/scaffold-inicial`) implementa mucho más (incidencias, login, admin) sin spec, sin tests y sin lockfile, y parte de supuestos que ya no valen (farolas en JSON estático, precisión visible, wa.me).

## What Changes

- **`web/`**: proyecto Angular estable (standalone, signals, zoneless, sin router) con una única página "Buenavista I · Incidencias — en construcción". Sin Leaflet todavía (llega en `mapa-farolas`).
- **`api/`**: Azure Functions modelo v4, Node 22, TypeScript estricto, con un único endpoint anónimo `GET /api/health`. Sin `@azure/data-tables` ni `google-auth-library` (llegan en sus cambios).
- **CI** (`.github/workflows/ci.yml`): `npm ci`, build y tests de `web/` y `api/` en cada PR y push a `main`.
- **Despliegue** (`.github/workflows/azure-swa.yml`): SWA Free con API gestionada (`apiRuntime: node:22`); se omite con aviso si no existe el secreto del token.
- **`staticwebapp.config.json`**: fallback de navegación y cabeceras de seguridad (CSP restrictiva: solo `self`).
- **Repo**: README con el stack real y cómo arrancar; comandos reales en `AGENTS.md` (fuera del bloque generado); `quality.config.json` con `appPaths` apuntando a `web/src/` y `api/src/` para que el spec gate vigile el código real.

## Capabilities

### New Capabilities

- `plataforma`: estructura del repo, endpoint de salud, CI, despliegue en SWA Free y garantías de coste y privacidad de la base.

### Modified Capabilities

Ninguna.

## Impact

- **Código nuevo**: `web/`, `api/`, `.github/workflows/ci.yml`, `.github/workflows/azure-swa.yml`. Modificados: `README.md`, `AGENTS.md`, `quality.config.json`.
- **Dependencias** (gratuitas, licencias permisivas): Angular, `@azure/functions` v4, TypeScript, Vitest. Versiones fijadas con `package-lock.json`.
- **Azure**: un Static Web App plan **Free** (0 €), que crea Rafa. Ningún otro recurso (ni Storage ni Application Insights).
- **RGPD**: no se recogen ni almacenan datos personales; sin cookies ni analítica.
- **Coste**: 0 €/mes.

## Out of scope

- Catálogo de farolas, Table Storage, carga del CSV y auditoría (cambio 2, `catalogo-farolas`).
- Mapa Leaflet y capas PNOA/OSM (cambio 3).
- Login, roles, incidencias, votos, gestión, reubicación, correo y baches (cambios 4–10).
- Tests e2e en navegador, PWA, dominio propio.
