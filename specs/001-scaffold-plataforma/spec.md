# Scaffold de la plataforma: Angular + Azure Functions, CI y despliegue a SWA Free

> Migrado de OpenSpec (`openspec/changes/scaffold-plataforma`) el 2026-11-13. Contenido sin cambios; el formato no sigue aún la plantilla de Spec Kit.

Primer cambio de la secuencia de [`docs/roadmap.md`](../../docs/roadmap.md). Sustituye a la propuesta `scaffold-mapa-farolas`, escrita antes de las decisiones de producto del 2026-11-12 (farolas en Table Storage vía API, precisión oculta al comunero) y que mezclaba scaffold, catálogo y mapa.

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

---

# Requisitos

> Migrado de OpenSpec (deltas de spec por capacidad). Formato: requisito + escenarios WHEN/THEN.

## Capacidad: plataforma

### ADDED Requirements

#### Requirement: Estructura del repositorio
El repositorio SHALL contener `web/` (Angular) y `api/` (Azure Functions modelo v4, Node 22, TypeScript), cada uno con su `package-lock.json` versionado. El repositorio MUST NOT contener proyectos .NET.

##### Scenario: Instalación reproducible
- **WHEN** se ejecuta `npm ci` en `web/` o en `api/`
- **THEN** la instalación usa exactamente las versiones del lockfile y termina sin error

#### Requirement: Endpoint de salud
La API SHALL exponer `GET /api/health`, anónimo, que responde `200` con cuerpo `{"estado":"ok"}` y cabecera `Cache-Control: no-store`, sin acceder a almacenamiento ni revelar versión o configuración.

##### Scenario: Comprobación de salud
- **WHEN** se hace `GET /api/health`
- **THEN** la respuesta es `200`, `{"estado":"ok"}` y `Cache-Control: no-store`

##### Scenario: Método no soportado
- **WHEN** se hace `POST /api/health`
- **THEN** la respuesta no es `200`

#### Requirement: Integración continua
La CI SHALL ejecutarse en cada pull request y en cada push a `main`, y MUST fallar si falla el build o los tests de `web/` o de `api/`. Los workflows MUST usar permisos mínimos (`contents: read` salvo el despliegue).

##### Scenario: PR con test roto
- **WHEN** un PR rompe un test de `api/`
- **THEN** el job `api` de la CI falla

#### Requirement: Despliegue en Static Web Apps Free
El despliegue SHALL publicar `web/` y `api/` en una Azure Static Web App de plan Free con API gestionada (`apiRuntime: node:22`) en cada push a `main`. Si no existe el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN`, el workflow MUST terminar sin error y con un aviso, sin desplegar.

##### Scenario: Push a main con token
- **WHEN** se fusiona un PR en `main` y el secreto existe
- **THEN** se despliegan la web y la API, y `GET /api/health` responde `200` en la URL de la SWA

##### Scenario: Sin token
- **WHEN** se hace push a `main` y el secreto no existe
- **THEN** el workflow termina en verde con el aviso de despliegue omitido

##### Scenario: Recarga en una ruta
- **WHEN** el navegador pide una ruta de la SPA que no es un fichero
- **THEN** SWA sirve `index.html`

#### Requirement: Coste y privacidad de la base
La plataforma MUST NOT crear ni requerir recursos de Azure de pago (incluidos Storage y Application Insights) en este cambio. La web MUST NOT usar cookies, analítica ni recursos de terceros, y SHALL enviar `Content-Security-Policy` con `default-src 'self'`, `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin`.

##### Scenario: Cabeceras de seguridad
- **WHEN** se pide `index.html` a la SWA desplegada
- **THEN** la respuesta incluye las tres cabeceras con esos valores

##### Scenario: Sin rastreo
- **WHEN** un vecino abre la web
- **THEN** no se establece ninguna cookie y no se hace ninguna petición a dominios distintos del propio
