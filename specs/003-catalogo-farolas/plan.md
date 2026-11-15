# Implementation Plan: Catálogo de farolas

**Branch**: `claude/project-thread-chd9ja` (issue #17) | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-catalogo-farolas/spec.md`

## Summary

Las 70 farolas pasan a la tabla `Farolas` de Table Storage, sembradas desde `data/farolas_buenavista.csv` por un script de `api/` que lanza a mano el workflow "Cargar farolas" (entorno `infra`, OIDC). `GET /api/farolas` las sirve sin sesión y sin precisión, con `Cache-Control: public, max-age=300`. Se crea el módulo `auditar()` (tabla `Auditoria`, partición `AAAA-MM`, campos prohibidos) y `RepositorioFarolas`, única puerta de escritura de `Farolas`, que audita como efecto de cada operación y deshace si la auditoría falla. Las credenciales pasan de un SAS de cuenta a un **SAS de servicio por tabla** (opción A): la app solo lee `Farolas` y solo añade y lee `Auditoria`.

## Technical Context

**Language/Version**: TypeScript 5.9 estricto, Node 22 (Azure Functions v4); Bicep para infraestructura.

**Primary Dependencies**: `@azure/functions` 4, `@azure/data-tables` 13 (ya en `api/package.json`; sin dependencias nuevas). CSV leído con un parser propio mínimo (el fichero no tiene comillas ni comas dentro de campos).

**Storage**: Azure Table Storage: tablas `Farolas` y `Auditoria` (nuevas, en `infra/main.bicep`). Azurite 3.35 en la CI.

**Testing**: Vitest (unitarias con el cliente de tablas simulado; integración contra Azurite en el job `api` de la CI, ya montado).

**Target Platform**: Functions gestionadas de Azure Static Web Apps Free; script de carga en `ubuntu-latest` de GitHub Actions.

**Project Type**: web-service (API de una web con front Angular, que no se toca en este cambio).

**Performance Goals**: 70 entidades en una partición; una consulta por petición, servida desde la caché de 5 min la mayor parte del tiempo.

**Constraints**: coste 0 € adicional (dos tablas vacías o casi; < 1 céntimo/mes); sin secretos en el repo ni en logs; el SAS de la app no puede borrar ni modificar la auditoría.

**Scale/Scope**: 70 farolas, 70 entradas de auditoría por entorno en la carga inicial; ~decenas de peticiones al día.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumple | Cómo |
|---|---|---|
| I. Coste 0–1 €/mes | ✅ | Dos tablas en la cuenta existente; ningún recurso nuevo de pago. El workflow de carga usa minutos gratuitos de Actions (repo público). |
| II. Privacidad por diseño | ✅ | Las farolas no son datos personales. `auditar()` rechaza email, sub, nombre, comentario y valores con forma de email; actor `sistema:carga`. SAS nunca en el repo ni en logs (enmascarados). Storage en `spaincentral`. |
| III. Toda escritura se audita | ✅ | `RepositorioFarolas` audita cada alta como efecto de la operación; si la auditoría falla, deshace el alta (constitución 1.1.0). Tests de la entrada generada. El SAS de `Auditoria` (solo `ra`) hace la auditoría append-only también frente a la propia app. |
| IV. Autorización en el servidor | ✅ | No hay escrituras desde la API en este cambio: `GET /api/farolas` es público por `docs/producto.md` y el SAS de la app no permite escribir `Farolas`. `PUT`/`POST` esperan al login (cambio 4) y van en el cambio 8. |
| V. Tests en la CI | ✅ | Unitarias + integración contra Azurite (desde este cambio, como pide la constitución). |
| VI. Simplicidad, S/M | ✅ | Tamaño M estimado (~500 líneas sin specs ni lockfiles). Sin dependencias nuevas. |

**Post-diseño (tras Fase 1)**: sin cambios; sin desviaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/003-catalogo-farolas/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── get-farolas.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
api/src/
├── tablas.ts                 # nombres de tabla y clientes por app setting (FAROLAS_CONNECTION, AUDITORIA_CONNECTION)
├── auditoria.ts              # auditar(): validación de actor y campos prohibidos, clave AAAA-MM
├── farolas.ts                # parseo y validación del CSV, entidad Farola, listarFarolas()
├── farolas-repo.ts           # RepositorioFarolas: única escritura de Farolas, audita y deshace si falla
├── carga-farolas.ts          # cargarFarolas(): solo altas, vía el repositorio
├── scripts/cargar-farolas.ts # punto de entrada del workflow (lee CSV y variables de entorno)
├── functions/farolas.ts      # GET /api/farolas
├── *.test.ts                 # unitarias
└── *.integration.test.ts     # integración contra Azurite (sustituye la prueba del SAS de cuenta)

infra/main.bicep              # tablas Farolas y Auditoria; un SAS de servicio por tabla; fuera TABLES_CONNECTION
infra/README.md               # SAS por tabla, rotación, orden de despliegue
.github/workflows/cargar-farolas.yml  # workflow_dispatch desde main, entorno infra, OIDC
data/farolas_buenavista.csv   # + fila F62
docs/producto.md, docs/roadmap.md, docs/decisions/registro.md
```

**Structure Decision**: se mantiene la estructura actual de `api/` (lógica pura en `src/*.ts`, registro de Functions en `src/functions/`). El script de carga se compila con el resto (`dist/scripts/`), pero no lo carga el host de Functions porque `main` solo apunta a `dist/functions/*.js`.

## Complexity Tracking

Sin violaciones de la constitución.
