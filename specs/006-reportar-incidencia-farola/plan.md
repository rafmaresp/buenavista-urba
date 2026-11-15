# Implementation Plan: Reportar y ver incidencias de farolas

**Branch**: `claude/project-thread-j8d714` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-reportar-incidencia-farola/spec.md`

## Summary

Cambio `reportar-incidencia-farola` del roadmap. Tabla nueva `Incidencias` con una partición por farola: el alta inserta la fila de la incidencia y después una fila candado `abierta`; insertar es condicional, así que si el candado ya existe falla con 409, se borra la fila nueva y no hay duplicado (FR-004). `RepositorioIncidencias` es la única puerta de escritura y audita `incidencia.alta` como efecto, borrando candado e incidencia si la auditoría falla. `POST /api/incidencias` usa `identificar()` (spec 005); `GET /api/incidencias` es anónimo y solo devuelve farola, estado y fecha. En la web, el mapa carga farolas e incidencias, marca las farolas con incidencia y la ficha muestra la incidencia o el formulario de aviso.

## Technical Context

**Language/Version**: TypeScript estricto; Node 22 (API), Angular 22 (web)

**Primary Dependencies**: `@azure/functions` v4, `@azure/data-tables`, Leaflet 1.9.4; sin dependencias nuevas

**Storage**: Azure Table Storage, tabla nueva `Incidencias` (SAS de servicio `rad`); `Farolas` (lectura) y `Auditoria` existentes

**Testing**: Vitest (unitarias `api/` y `web/`), integración contra Azurite (`incidencias.integration.test.ts`), e2e Playwright (`e2e/tests/incidencias.spec.ts`)

**Target Platform**: Azure Static Web Apps Free con API gestionada

**Project Type**: web (Angular + Functions)

**Performance Goals**: alta = 1 lectura de `Farolas` + 2 inserciones en `Incidencias` + 1 en `Auditoria`; consulta = 1 consulta de `Incidencias`

**Constraints**: 0 € adicionales; sin PII ni comentario en logs; comentario ≤ 280

**Scale/Scope**: 70 farolas, decenas de incidencias al año

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumple | Cómo |
|---|---|---|
| I. Coste 0–1 € | Sí | Una tabla más en la cuenta existente; sin recursos nuevos |
| II. Privacidad | Sí | Autor = uid; comentario solo en la tabla, nunca en GET, logs ni auditoría (`comentarioPresente`, `comentarioLongitud`); test de ambos |
| III. Toda escritura se audita | Sí | `RepositorioIncidencias.crear()` audita y deshace (borra candado e incidencia) si falla; error propio `IncidenciaSinAuditar` si deshacer falla; tests de los tres casos |
| IV. Autorización en el servidor | Sí | `POST` llama a `identificar()` en cada petición; el front solo muestra el botón |
| V. Tests en la CI | Sí | Unitarias, integración con SAS `rad` real y concurrencia, e2e sin sesión |
| VI. Simplicidad | Sí | Sin cola ni índices aparte: una fila candado por farola con inserción condicional. Reutiliza `identificar`, `entidadDeAuditoria`, `tablaClient`, `Sesion.llamar`. Tamaño M |

Re-check tras Phase 1: sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/006-reportar-incidencia-farola/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
└── tasks.md
```

### Source Code (repository root)

```text
api/src/
├── incidencias.ts                     # modelo y validación de la petición
├── incidencias-http.ts                # respuestas de GET y POST
├── incidencias-repo.ts                # RepositorioIncidencias (escritura + auditoría + deshacer)
├── incidencias.test.ts
├── incidencias-repo.test.ts
├── incidencias.integration.test.ts    # Azurite: SAS rad, duplicados concurrentes
├── pruebas/incidencias-dobles.ts      # tabla en memoria para las unitarias
├── tablas.ts                          # + 'Incidencias'
└── functions/incidencias.ts           # GET anónimo, POST con identidad
infra/main.bicep                       # tabla Incidencias + INCIDENCIAS_CONNECTION (rad)
web/src/app/mapa/
├── incidencias-cliente.ts (+ .spec)   # GET y POST
├── mapa-farolas.ts / .html (+ .spec)  # marca distinta, ficha con incidencia o formulario
web/src/styles.css                     # estilo de la marca y del formulario
e2e/tests/farolas.fixture.ts           # simularApiIncidencias()
e2e/tests/incidencias.spec.ts          # vista sin sesión y POST sin identidad = 401
infra/README.md, docs/roadmap.md, docs/decisions/registro.md
```

**Structure Decision**: estructura existente `api/` + `web/` + `e2e/`; los ficheros nuevos siguen el patrón de farolas (lógica pura + repositorio + Function fina).

## Complexity Tracking

Sin violaciones.
