# Implementation Plan: Mapa de farolas en solo lectura

**Branch**: `claude/project-thread-btefzp` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-mapa-farolas/spec.md`

## Summary

Página principal con un mapa Leaflet a pantalla completa (móvil primero), fondo Ortofoto PNOA por defecto y Callejero OSM con selector, que pinta las farolas de `GET /api/farolas` como marcas DOM con su código y abre una ficha (código y calle) al tocarlas. Leaflet y su CSS van empaquetados en el build de Angular. Si el catálogo falla, aviso con "Reintentar". Sin cambios en `api/`: el endpoint ya existe (cambio catálogo de farolas).

## Technical Context

**Language/Version**: TypeScript 6 (Angular 22, componentes standalone y signals)

**Primary Dependencies**: `leaflet` 1.9.4 (+ `@types/leaflet`), empaquetado por `@angular/build`. Sin envoltorios de Angular para Leaflet.

**Storage**: N/A (solo lectura de `GET /api/farolas`)

**Testing**: Vitest con jsdom (`ng test`) para el cliente del catálogo y el componente; Playwright contra la CLI de SWA (`e2e/`) en escritorio y Pixel 7

**Target Platform**: navegadores móviles y de escritorio actuales; Azure Static Web Apps Free

**Project Type**: aplicación web (`web/` + `api/`)

**Performance Goals**: mapa usable en < 3 s en 4G con la API en caliente; 70 marcas sin degradación

**Constraints**: CSP estricta (`default-src 'self'`): solo se abren `img-src` a `https://www.ign.es` y `https://tile.openstreetmap.org` y `data:`; sin estilos de componente (Angular los inyecta como `<style>` en línea y la CSP los bloquearía), todo en `styles.css`; presupuesto inicial del bundle 500 kB aviso / 1 MB error

**Scale/Scope**: 70 farolas, una pantalla

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumple | Cómo |
|---|---|---|
| I. Coste 0–1 €/mes | Sí | Sin recursos nuevos. Teselas públicas gratuitas de IGN y OSM. |
| II. Privacidad por diseño | Sí | Sin datos personales, cookies ni analítica. Leaflet autohospedado. IGN y OSM reciben la IP del visitante al pedir teselas (ya recogido en la propuesta RGPD; la mención en `/privacidad` llega con el login). |
| III. Toda escritura se audita | N/A | No escribe. |
| IV. Autorización en el servidor | N/A | Endpoint anónimo ya existente; no hay controles por rol. |
| V. Tests en la CI | Sí | Vitest en `web/` + e2e Playwright del mapa (primer e2e de funcionalidad, como pide la constitución "desde el mapa"). |
| VI. Simplicidad | Sí | Leaflet directo, `fetch` en vez de `HttpClient` (no hace falta tocar `app.config.ts`), sin estado global. Tamaño M. |

Re-check tras el diseño: sin cambios, sin desviaciones.

## Project Structure

### Documentation (this feature)

```text
specs/004-mapa-farolas/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── get-farolas-cliente.md
│   └── ui-mapa.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
web/
├── angular.json                         # + leaflet.css en styles
├── package.json                         # + leaflet, @types/leaflet
├── public/staticwebapp.config.json      # CSP: img-src IGN/OSM
└── src/
    ├── styles.css                       # pantalla completa + estilos del mapa
    └── app/
        ├── app.html / app.ts / app.spec.ts   # cabecera + <app-mapa-farolas>
        └── mapa/
            ├── farolas-cliente.ts(+.spec)    # fetch + validación de la respuesta
            ├── capas.ts                      # PNOA/OSM, centro y zoom
            └── mapa-farolas.ts/.html(+.spec) # componente: mapa, marcas, ficha, error
e2e/
└── tests/
    ├── farolas.fixture.ts               # 70 farolas leídas de data/farolas_buenavista.csv
    └── mapa.spec.ts                     # carga, 70 marcas, ficha, capas, error
```

**Structure Decision**: aplicación web existente. Todo el cambio vive en `web/src/app/mapa/` y `e2e/tests/`; la shell (`app.html`) solo sustituye el "En construcción" por el componente, para chocar lo mínimo con el login, que se hace en paralelo.

## Complexity Tracking

Sin desviaciones.
