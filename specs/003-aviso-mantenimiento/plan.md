# Implementation Plan: Aviso de mantenimiento programado en el mapa

**Branch**: `claude/issue-12-20261114-2308` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-aviso-mantenimiento/spec.md`

## Summary

La directiva publica o quita un único aviso (fecha y hora, texto ≤ 140) que el mapa público muestra como banner hasta que pasa la fecha. Enfoque: tabla `Avisos` en Table Storage; `GET /api/aviso` anónimo y cacheable con caducidad calculada en servidor; `PUT /api/aviso` y `DELETE /api/aviso` solo directiva, con auditoría en la misma operación; componente de banner en la página del mapa y un formulario mínimo para la directiva. Depende de los cambios 3 (mapa) y 4 (login y roles) del roadmap.

## Technical Context

**Language/Version**: TypeScript estricto, Node 22 (`api/`); Angular (`web/`)

**Primary Dependencies**: Azure Functions v4, `@azure/data-tables`, Leaflet (ya previsto por el mapa); sin dependencias nuevas

**Storage**: Azure Table Storage, tabla nueva `Avisos` (declarada en `infra/` Bicep) y tabla `Auditoria` existente desde el cambio 2

**Testing**: Vitest en `web/` y `api/`; integración contra Azurite; e2e con Playwright (infraestructura del cambio 3)

**Target Platform**: Azure Static Web Apps (Free) con API gestionada

**Project Type**: web (Angular + Functions)

**Performance Goals**: el aviso llega al visitante en la misma carga del mapa; publicar o quitar se refleja en ≤ 1 min (SC-002)

**Constraints**: coste adicional despreciable; cabecera de caché corta (≤ 60 s) en `GET /api/aviso`; texto plano; hora Europa/Madrid

**Scale/Scope**: 1 aviso vigente, ≤ decenas de escrituras al año; 1 tabla, 3 endpoints, 1 componente de banner, 1 formulario

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Coste 0–1 €/mes | Una tabla más en la cuenta de Storage existente; sin servicios nuevos | OK |
| II. Privacidad por diseño | El aviso no lleva datos personales; autor solo como `uid` interno, nunca en la respuesta pública; la auditoría no copia el texto | OK |
| III. Toda escritura se audita | PUT y DELETE generan entrada de `Auditoria` en la misma operación; tests de la entrada | OK |
| IV. Autorización en el servidor | Rol directiva comprobado en cada escritura con el ID token validado; el front solo oculta controles | OK |
| V. Tests en la CI | Vitest, Azurite y e2e del banner y de los permisos | OK |
| VI. Simplicidad y cambios pequeños | Un solo aviso, sin historial ni programación; tamaño estimado S–M | OK |

Post-diseño (Phase 1): sin cambios; no hay violaciones, así que no se rellena Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-aviso-mantenimiento/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── aviso.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
api/
├── src/
│   ├── functions/aviso.ts        # GET/PUT/DELETE /api/aviso
│   └── lib/aviso.ts              # validación, caducidad, acceso a la tabla
└── tests/                        # unitarios e integración (Azurite)

web/
└── src/app/
    ├── aviso/                    # banner, formulario de directiva y servicio
    └── mapa/                     # integra el banner (cambio 3)

infra/                            # tabla Avisos en Bicep
```

**Structure Decision**: aplicación web existente (`web/` + `api/`) más la declaración de la tabla en `infra/`. Las rutas exactas de `web/` y `api/` se ajustan a lo que dejen los cambios 3 y 4 al implementar.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
