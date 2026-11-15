# Implementation Plan: Cambiar el estado de una incidencia (directiva)

**Branch**: `claude/project-thread-fx62nb` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-cambiar-estado-incidencia/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

La directiva cambia el estado de una incidencia abierta desde la ficha de la farola. `PUT /api/incidencias/{id}` (cuerpo `{farola, estado}`) identifica con `identificar()`, exige rol `directiva` y delega en `RepositorioIncidencias.cambiarEstado()`, que valida la transición (solo hacia delante), actualiza la fila con su ETag (sin pisar cambios simultáneos), borra el candado al completar y audita `incidencia.estado`; si la auditoría falla, deshace (estado anterior y candado). La web añade a la ficha un selector con los estados siguientes, visible solo con rol directiva. El SAS de `Incidencias` pasa de `rad` a `raud`.

## Technical Context

**Language/Version**: TypeScript estricto; Node 22 (api), Angular 20 (web)

**Primary Dependencies**: `@azure/functions` v4, `@azure/data-tables`, `google-auth-library`; Leaflet en la web. Ninguna nueva.

**Storage**: Azure Table Storage, tablas existentes `Incidencias` y `Auditoria` (sin tablas nuevas)

**Testing**: Vitest (api y web), integración contra Azurite, Playwright (e2e contra la CLI de SWA)

**Target Platform**: Azure Static Web Apps Free con API gestionada

**Project Type**: web-service + web app

**Performance Goals**: sin requisitos especiales (decenas de incidencias); 4 operaciones de tabla por cambio como máximo (leer candado, leer fila, actualizar, borrar candado) más la auditoría

**Constraints**: coste 0 €; sin datos personales en logs ni auditoría; autorización en el servidor

**Scale/Scope**: 70 farolas, una incidencia abierta por farola, una persona de la directiva a la vez en la práctica

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumple | Cómo |
|---|---|---|
| I. Coste 0–1 €/mes | Sí | Sin recursos nuevos; solo cambia el permiso del SAS existente. |
| II. Privacidad | Sí | La auditoría guarda solo `{estado}` antes y después y el `uid`; la respuesta no lleva autor ni comentario; logs con nombre y código del error. |
| III. Toda escritura se audita | Sí | `cambiarEstado()` en el repositorio escribe, audita y deshace si falla; tests de la entrada y del deshacer. |
| IV. Autorización en el servidor | Sí | `identificar()` en cada petición y rol `directiva` comprobado en la Function; la web solo oculta el selector. |
| V. Tests en la CI | Sí | Unitarias de repo, HTTP y web; integración Azurite con el SAS `raud`; e2e del 401 y del selector oculto sin sesión. |
| VI. Simplicidad | Sí | Reutiliza repositorio, candado, `identificar()`, `auditar()`, `Sesion.llamar` y la ficha. Tamaño estimado M (≈ 500 líneas sin specs). |

Re-check tras el diseño: sin cambios, sin desviaciones.

## Project Structure

### Documentation (this feature)

```text
specs/008-cambiar-estado-incidencia/
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
├── incidencias.ts               # ESTADOS, esPosterior(), validarCambio()
├── incidencias-repo.ts          # cambiarEstado(), errores NoEncontrada / TransicionNoValida / HaCambiado
├── incidencias-http.ts          # respuestaCambiarEstado()
├── functions/incidencias.ts     # app.http('incidencias-estado', PUT incidencias/{id})
├── pruebas/incidencias-dobles.ts  # doble con ETag y updateEntity
└── *.test.ts, incidencias.integration.test.ts, tablas.test.ts
web/src/app/mapa/
├── incidencias-cliente.ts       # ESTADOS, estadosSiguientes(), cambiarEstado()
└── mapa-farolas.ts              # selector en la ficha (solo directiva)
infra/main.bicep                 # SAS de Incidencias: rad → raud
e2e/tests/incidencias.spec.ts    # PUT sin token → 401; sin sesión no hay selector
docs/                            # roadmap (cambio 7 partido) y registro de decisiones
```

**Structure Decision**: se amplían los módulos de incidencias del cambio 006; nada nuevo fuera de ellos. La comprobación del rol va en `incidencias-http.ts` (no en `identidad.ts`) para no chocar con el cambio paralelo de reubicar farolas.

## Complexity Tracking

Sin violaciones.
