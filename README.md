# Buenavista I · Incidencias

Web de incidencias de la urbanización Buenavista I (Dos Hermanas): farolas fundidas, baches, fugas y otros avisos, con panel de gestión para la junta.

## Stack

- **Front** (`web/`): Angular 22 + Leaflet (Leaflet llega con la feature `mapa-farolas`).
- **API** (`api/`): Azure Functions v4, Node 22, TypeScript.
- **Datos**: Azure Table Storage con `@azure/data-tables` (aún sin usar).
- **Hosting**: Azure Static Web Apps (plan Free).

Producto y roadmap: `docs/producto.md` y `docs/roadmap.md`; specs en `specs/`. La infraestructura Azure se creará con Bicep en la feature `002-infra-bicep`; hasta entonces el despliegue se omite si falta el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN`.

## Requisitos

- Node 22 y npm
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4 (`func`), solo para arrancar la API

## Arrancar en local

```bash
# Web
cd web && npm ci && npm start     # http://localhost:4200

# API
cd api && npm ci && cp local.settings.sample.json local.settings.json
npm start                         # compila y lanza func; GET http://localhost:7071/api/health
```

`local.settings.json` está en `.gitignore`; no se versiona.

## Build y tests

```bash
cd web && npm ci && npm run build && npm test
cd api && npm ci && npm run build && npm test
```

## Cómo se trabaja

El desarrollo se pide con issues de GitHub y lo hace Claude Code en GitHub Actions; Rafa revisa y fusiona todos los PRs. Reglas en `AGENTS.md` y principios en `.specify/memory/constitution.md`.
