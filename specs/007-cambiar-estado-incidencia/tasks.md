---

description: "Task list for feature implementation"
---

# Tasks: Cambiar el estado de una incidencia (directiva)

**Input**: Design documents from `/specs/007-cambiar-estado-incidencia/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: Obligatorios por la constitución (III y V): entrada de auditoría, deshacer si la auditoría falla, autorización en servidor.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Phase 1: Setup

- [X] T001 Cambiar el SAS de `Incidencias` de `rad` a `raud` y su comentario en infra/main.bicep, y la expectativa de permisos en api/src/tablas.test.ts

## Phase 2: Foundational

- [X] T002 Añadir en api/src/incidencias.ts `ESTADOS = ['Nuevo', 'Recibido', 'Profesional notificado', 'Completado']`, `esPosterior(actual, destino)` ("índice destino > índice actual") y `validarCambio(id, cuerpo)` (id uuid, `farola` `^F\d{2}$`, `estado` ∈ ESTADOS; campos de más ignorados), con tests en api/src/incidencias.test.ts
- [X] T003 Ampliar `ClienteTablaIncidencias` (getEntity con `etag`, `updateEntity(entity, 'Merge', { etag })`, `deleteEntity(pk, rk, { etag })`) en api/src/incidencias-repo.ts y el doble con ETag y 412 en api/src/pruebas/incidencias-dobles.ts

## Phase 3: User Story 1 - La directiva avanza el estado (P1) 🎯 MVP

**Goal**: cambiar el estado de la incidencia abierta, solo hacia delante, auditado.

**Independent Test**: Nuevo → Recibido deja Recibido y una entrada `incidencia.estado` con `{estado}` antes y después.

- [X] T004 [US1] Tests de `cambiarEstado()` en api/src/incidencias-repo.test.ts: cambio válido y entrada de auditoría (sin autor ni comentario), saltar estados, retroceder o repetir → `TransicionNoValida`, incidencia que no es la del candado → `NoEncontrada`, ETag desfasado → `HaCambiado` con el estado actual, auditoría que falla → estado anterior restaurado, deshacer que falla → `IncidenciaSinAuditar`
- [X] T005 [US1] Implementar `cambiarEstado({ farola, id, estado, actor })` y los errores `NoEncontrada`, `TransicionNoValida`, `HaCambiado` en api/src/incidencias-repo.ts (leer candado → leer fila con ETag → validar → Merge con ETag → auditar → deshacer si falla)
- [X] T006 [P] [US1] Cliente web: `ESTADOS`, `estadosSiguientes(estado)` y `cambiarEstado(llamar, incidencia, estado)` con `ErrorCambio` (`sin-sesion`, `ha-cambiado` con la incidencia actual, `no-disponible`) en web/src/app/mapa/incidencias-cliente.ts, con tests en web/src/app/mapa/incidencias-cliente.spec.ts
- [X] T007 [US1] Ficha: selector con los estados siguientes y botón "Guardar estado", solo si `Sesion.rol() === 'directiva'`; al guardar, la ficha y la marca muestran el estado nuevo; errores en la ficha; en web/src/app/mapa/mapa-farolas.ts con tests en web/src/app/mapa/mapa-farolas.spec.ts

## Phase 4: User Story 2 - Completar libera la farola (P1)

**Goal**: al completar, la farola vuelve a admitir avisos.

**Independent Test**: completar y luego avisar de nuevo crea una incidencia en Nuevo.

- [X] T008 [US2] Tests en api/src/incidencias-repo.test.ts: completar borra el candado y la incidencia sale de `abiertas()`; un aviso posterior crea otra; si la auditoría falla se recrea el candado y se restaura el estado
- [X] T009 [US2] En `cambiarEstado()` de api/src/incidencias-repo.ts, borrar el candado (con su ETag) al pasar a `Completado` y recrearlo al deshacer
- [X] T010 [US2] Integración contra Azurite con el SAS `raud` en api/src/incidencias.integration.test.ts: Nuevo → Recibido → Completado, auditoría de cada cambio y nuevo aviso aceptado; dos cambios simultáneos dejan uno solo
- [X] T011 [US2] En la web, al completar: quitar la incidencia, devolver la marca a normal y que la ficha ofrezca avisar, en web/src/app/mapa/mapa-farolas.ts (+ test en mapa-farolas.spec.ts)

## Phase 5: User Story 3 - Solo la directiva (P1)

**Goal**: autorización en el servidor.

**Independent Test**: la misma petición con comunero → 403 y con directiva → 200.

- [X] T012 [US3] Tests de `respuestaCambiarEstado()` en api/src/incidencias.test.ts: 401 sin token, 403 comunero (cuerpo `sin-acceso`, sin leer la tabla), 400 entrada no válida, 404, 409 `transicion-no-valida` y `ha-cambiado`, 503 sin el SAS en el log, 200
- [X] T013 [US3] Implementar `respuestaCambiarEstado(cabeceras, id, leerCuerpo, identidad, deps)` en api/src/incidencias-http.ts y registrar `app.http('incidencias-estado', { methods: ['PUT'], route: 'incidencias/{id}' })` en api/src/functions/incidencias.ts
- [X] T014 [P] [US3] e2e en e2e/tests/incidencias.spec.ts: PUT sin token → 401; sin sesión la ficha con incidencia no muestra selector

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 [P] docs/roadmap.md (cambio 7 partido: `cambiar-estado-incidencia` hecho aquí, `gestion-estados` con lo que queda), docs/producto.md (transiciones confirmadas o pendientes) y decisión al final de docs/decisions/registro.md
- [X] T016 Revisión con la skill `revisar-seguridad`; build y tests en verde en api/ y web/

## Dependencies & Execution Order

- T001–T003 antes de todo. US1 (T004–T007) antes de US2 (amplía `cambiarEstado()` y la ficha). US3 (T012–T013) necesita T005; T014 necesita T013.
- MVP: Phase 1–3 + T012–T013.

## Parallel Example

- T006 (cliente web) en paralelo con T004–T005 (repo api).
- T014 y T015 en paralelo al final.

## Implementation Strategy

Repositorio primero (lo que garantiza auditoría y concurrencia), después HTTP con el rol, después la web. Un único PR (flujo ligero).
