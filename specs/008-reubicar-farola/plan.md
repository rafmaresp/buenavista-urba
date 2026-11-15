# Implementation Plan: Reubicar farola (directiva)

**Branch**: `claude/project-thread-2yclir` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-reubicar-farola/spec.md`

## Summary

Parte del cambio `reubicar-farola` del roadmap: solo la reubicación (sin `POST` ni precisión en el `GET`). `PUT /api/farolas/{id}` identifica con `identificar()` (spec 005), exige rol `directiva`, valida id y coordenadas con los mismos límites que la semilla y delega en `RepositorioFarolas.reubicar()`, que lee la farola, la actualiza con `Merge` condicionado al ETag leído (409 si cambió), audita `farola.reubicacion` con antes/después `{lat, lon, precision}` y, si la auditoría falla, restaura la posición anterior condicionada al ETag de su propia escritura. El SAS de `Farolas` de la app pasa de `r` a `ru`. En la web, la ficha muestra "Mover" solo a la directiva; la marca se vuelve arrastrable, al soltarla una barra pregunta "¿Mover F07 aquí?" y Guardar llama al `PUT`; Cancelar o un error devuelven la marca.

## Technical Context

**Language/Version**: TypeScript estricto; Node 22 (API), Angular 22 (web)

**Primary Dependencies**: `@azure/functions` v4, `@azure/data-tables`, Leaflet 1.9.4 (arrastre nativo de `L.Marker`); sin dependencias nuevas

**Storage**: Azure Table Storage, tabla `Farolas` (SAS de la app `r` → `ru`) y `Auditoria` (`ra`, sin cambios)

**Testing**: Vitest (unitarias `api/` y `web/`), integración contra Azurite con el SAS `ru` (`farolas-reubicar.integration.test.ts`), e2e Playwright (`e2e/tests/reubicar.spec.ts`) con login simulado de directiva

**Target Platform**: Azure Static Web Apps Free con API gestionada

**Project Type**: web (Angular + Functions)

**Performance Goals**: una reubicación = 1 lectura + 1 actualización en `Farolas` + 1 inserción en `Auditoria` (más la lectura de `Usuarios` de `identificar()`)

**Constraints**: 0 € adicionales; sin PII en logs ni auditoría; arrastre usable con el dedo

**Scale/Scope**: 70 farolas, unas pocas reubicaciones al año

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumple | Cómo |
|---|---|---|
| I. Coste 0–1 € | Sí | Sin recursos nuevos; solo cambia el permiso de un SAS |
| II. Privacidad | Sí | Auditoría con actor = uid y solo `{lat, lon, precision}`; el cuerpo de la petición no se registra; errores solo con nombre y código |
| III. Toda escritura se audita | Sí | `RepositorioFarolas.reubicar()` audita como efecto y restaura si falla; error propio `ReubicacionSinAuditar` si restaurar también falla; tests de los tres casos |
| IV. Autorización en el servidor | Sí | `identificar()` en cada petición y comprobación de `rol === 'directiva'` en la Function; el front solo muestra "Mover" |
| V. Tests en la CI | Sí | Unitarias de validación, repositorio y HTTP; integración con SAS `ru` real; e2e del arrastre con API simulada y del 401 real |
| VI. Simplicidad | Sí | Reutiliza `identificar`, `entidadDeAuditoria`, `RepositorioFarolas`, límites de `parsearSemilla`, `Sesion.llamar` y el arrastre de Leaflet. Tamaño M |

Re-check tras Phase 1: sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/008-reubicar-farola/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/put-farola.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
api/src/
├── farolas.ts                               # + validarReubicacion() y límites exportados
├── farolas-repo.ts                          # + reubicar(), FarolaNoEncontrada, FarolaCambiada, ReubicacionSinAuditar
├── farolas-http.ts                          # nuevo: respuestaReubicar()
├── farolas.test.ts / farolas-repo.test.ts   # + casos
├── farolas-http.test.ts                     # nuevo
├── farolas-reubicar.integration.test.ts     # nuevo: Azurite con SAS ru
├── tablas.test.ts                           # permisos: Farolas ru
└── functions/farolas.ts                     # + PUT farolas/{id}
infra/main.bicep                             # SAS de Farolas r → ru
web/src/app/mapa/
├── farolas-cliente.ts (+ .spec)             # + reubicarFarola()
├── mapa-farolas.ts / .html (+ .spec)        # Mover, arrastre, barra de confirmación
web/src/styles.css                           # barra de mover
e2e/tests/farolas.fixture.ts                 # + entrarComoDirectiva()
e2e/tests/reubicar.spec.ts                   # nuevo
infra/README.md, docs/roadmap.md, docs/decisions/registro.md
```

**Structure Decision**: misma estructura que las specs 003–006: lógica pura y repositorio en `api/src`, Function fina en `api/src/functions`, cliente HTTP y componente del mapa en `web/src/app/mapa`. La lógica HTTP va en `farolas-http.ts` (como `incidencias-http.ts`) para no tocar el `GET` público.

## Complexity Tracking

Sin violaciones.
