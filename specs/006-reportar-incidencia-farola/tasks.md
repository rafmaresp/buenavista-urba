---
description: "Tareas de reportar-incidencia-farola"
---

# Tasks: Reportar y ver incidencias de farolas

**Input**: Design documents from `specs/006-reportar-incidencia-farola/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: obligatorios por la constitución (V) y la III (entrada de auditoría y deshacer).

**Organization**: por historia de usuario.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Añadir la tabla `Incidencias` a `TABLAS` en api/src/tablas.ts y su comprobación de permiso `rad` en api/src/tablas.test.ts
- [X] T002 Declarar `tablaIncidencias`, su SAS de servicio `signedPermission: 'rad'` y el app setting `INCIDENCIAS_CONNECTION` en infra/main.bicep

---

## Phase 2: Foundational

- [X] T003 Modelo y validación en api/src/incidencias.ts: `validarPeticion()` (farola `^F\d{2}$`; `comentario` opcional, string, recortado, "0–280 caracteres"; cuerpo no objeto → inválido), tipo `IncidenciaPublica {id, farola, estado, creada}` y estado inicial `Nuevo`
- [X] T004 `RepositorioIncidencias` en api/src/incidencias-repo.ts: `crear()` insertando la incidencia (RowKey uuid, tipo farola-fundida, estado Nuevo, autor uid, creada, comentario) y después el candado (RowKey abierta, incidencia) con inserción condicional, auditoría `incidencia.alta` con `despues {farola, estado, comentarioPresente, comentarioLongitud}`, deshacer borrando candado e incidencia y `IncidenciaSinAuditar`; `abiertaDe(farola)` y `abiertas()` con `select` sin autor ni comentario; 409 → `YaAbierta` con la existente

**Checkpoint**: repositorio listo para las Functions.

---

## Phase 3: User Story 1 - Un comunero avisa de una farola fundida (P1) 🎯 MVP

**Goal**: crear incidencias auditadas desde la ficha.

**Independent Test**: POST con usuario activo crea la incidencia `Nuevo` y su auditoría sin comentario.

- [X] T005 [P] [US1] Unitarias del repositorio en api/src/incidencias-repo.test.ts: alta y entrada de auditoría, auditoría inválida no escribe, deshacer si la auditoría falla, `IncidenciaSinAuditar`
- [X] T006 [P] [US1] Unitarias de validación y de `respuestaCrear()` (api/src/incidencias-http.ts) en api/src/incidencias.test.ts, con el doble api/src/pruebas/incidencias-dobles.ts: 201, 400 (farola inexistente en `Farolas`, comentario > 280, no JSON), 401/403 de `identificar()`, 503 sin detalles en el log
- [X] T007 [US1] `respuestaCrear()` en api/src/incidencias-http.ts: `identificar()`, validar, comprobar que la farola existe en `Farolas`, crear y responder según contracts/api.md
- [X] T008 [US1] Function `incidencias` (POST) en api/src/functions/incidencias.ts
- [X] T009 [P] [US1] Cliente `reportarIncidencia()` en web/src/app/mapa/incidencias-cliente.ts (POST con `Sesion.llamar`) y su spec
- [X] T010 [US1] Ficha con formulario en web/src/app/mapa/mapa-farolas.ts: con sesión, comentario `maxlength=280`, contador, aviso de no escribir datos de terceros y botón "Avisar: farola fundida"; sin sesión, enlace "Entra para avisar" a /login; tras 201 o 409, actualizar ficha y marca
- [X] T011 [US1] Specs del formulario en web/src/app/mapa/mapa-farolas.spec.ts

---

## Phase 4: User Story 2 - No se duplican avisos (P1)

**Goal**: una sola incidencia abierta por farola, también con avisos simultáneos.

**Independent Test**: dos POST simultáneos contra Azurite dejan una sola incidencia.

- [X] T012 [US2] Respuesta 409 `ya-abierta` con la existente en api/src/incidencias-http.ts y su unitaria en api/src/incidencias.test.ts
- [X] T013 [US2] Integración en api/src/incidencias.integration.test.ts (SAS `rad` real): alta, segundo alta → `YaAbierta`, dos altas simultáneas → una sola fila, la auditoría no lleva el comentario, deshacer con el SAS de la app si la auditoría falla

---

## Phase 5: User Story 3 - Cualquiera ve las incidencias abiertas (P2)

**Goal**: marcas distintas y estado en la ficha, sin sesión.

**Independent Test**: GET anónimo devuelve solo abiertas sin autor ni comentario; el mapa las marca.

- [X] T014 [US3] `respuestaListar()` en api/src/incidencias-http.ts (anónima, `no-store`, 500 genérico) y GET en api/src/functions/incidencias.ts, con unitarias en api/src/incidencias.test.ts (sin `autor` ni `comentario`, excluye `Completado` y el candado)
- [X] T015 [P] [US3] Cliente `cargarIncidencias()` con validación de forma en web/src/app/mapa/incidencias-cliente.ts y su spec
- [X] T016 [US3] Mapa: cargador de incidencias, clase `farola-marca--incidencia`, ficha "Incidencia abierta: <estado>, avisada el dd/mm/aaaa", aviso si fallan las incidencias, en web/src/app/mapa/mapa-farolas.ts, mapa-farolas.html y web/src/styles.css, con specs
- [X] T017 [US3] e2e en e2e/tests/incidencias.spec.ts: incidencias simuladas, farola marcada y ficha; enlace para entrar sin sesión; `POST /api/incidencias` sin token = 401

---

## Phase 6: Polish & Cross-Cutting

- [X] T018 [P] Actualizar docs/roadmap.md (cambio 5 en curso, test users pendientes) y añadir la decisión al final de docs/decisions/registro.md
- [X] T019 Revisar seguridad (skill `revisar-seguridad`) y ejecutar build y tests de api/, web/ y e2e/

## Dependencies & Execution Order

- Setup (T001–T002) → Foundational (T003–T004) → US1 → US2 → US3 → Polish.
- US2 reutiliza el repositorio y la respuesta de US1; US3 solo depende de Foundational en la API, pero la ficha comparte código con US1.

## Parallel Example

- T005 y T006 (tests en ficheros distintos); T009 y T015 (cliente web) con la API.

## Implementation Strategy

MVP = US1 + US2 (avisar sin duplicados). US3 completa la vista pública en el mismo PR.
