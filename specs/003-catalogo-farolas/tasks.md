---

description: "Tareas del cambio 2: catálogo de farolas"
---

# Tasks: Catálogo de farolas

**Input**: Design documents from `specs/003-catalogo-farolas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/get-farolas.md, quickstart.md

**Tests**: obligatorios (constitución V y principio III: tests de la entrada de auditoría; integración contra Azurite desde este cambio).

**Organization**: por historia de usuario (US1 consultar, US2 sembrar, US3 auditoría a prueba de manipulación).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: semilla y tablas declaradas

- [X] T001 Añadir la fila de F62 a `data/farolas_buenavista.csv` entre F61 y F63 como farola normal: `62,C. H / C. Q,37.3154785,-5.9617603,estimada` (sin "inferida" ni marcas especiales)
- [X] T002 [P] Declarar las tablas `Farolas` y `Auditoria` (`Microsoft.Storage/storageAccounts/tableServices/tables`, `parent: tableService`) en `infra/main.bicep`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: nombres de tabla, clientes y credenciales por tabla (opción A)

- [X] T003 Crear `api/src/tablas.ts`: `TABLAS = ['Farolas', 'Auditoria'] as const`, `tablaClient(tabla)` que lee `FAROLAS_CONNECTION` o `AUDITORIA_CONNECTION` (error claro si falta, sin imprimir el valor) y `TableClient.fromConnectionString`
- [X] T004 Sustituir en `infra/main.bicep` el SAS de cuenta (`TABLES_CONNECTION`) por dos `listServiceSas()` con `canonicalizedResource: '/table/<cuenta>/<tabla en minúsculas>'`, HTTPS, `sasExpiry` y `sasKey`: `Farolas` → `r`, `Auditoria` → `ra`; añadir `tn=<tabla>` si el token no lo trae; app settings `FAROLAS_CONNECTION` y `AUDITORIA_CONNECTION`
- [X] T005 [P] Test `api/src/tablas.test.ts`: los nombres de los recursos `tableServices/tables` de `infra/main.bicep` son exactamente `TABLAS`, y cada tabla tiene su app setting `<TABLA>_CONNECTION` en el Bicep

**Checkpoint**: tablas y credenciales listas.

---

## Phase 3: User Story 3 - Auditoría a prueba de manipulación (Priority: P2, se hace antes porque la carga la usa)

**Goal**: `auditar()` reutilizable y append-only.

**Independent Test**: unitarias de validación + integración con el SAS `ra`.

### Tests for User Story 3

- [X] T006 [P] [US3] Unitarias en `api/src/auditoria.test.ts`: actor "UUID (uid opaco), `sistema:<nombre>` o `dev:<alias>` (`[a-z][a-z0-9-]*`)" acepta y rechaza; `PartitionKey` = mes UTC `AAAA-MM` (incluido fin de mes en UTC); `RowKey` `<ISO>_<UUID>`; rechaza claves `email`, `correo`, `sub`, `nombre`, `name`, `comentario` en cualquier nivel y sin distinguir mayúsculas, y valores con forma de email; `antes`/`despues` en JSON o vacío; si la escritura de auditoría falla, `conAuditoria` no ejecuta la escritura de datos

### Implementation for User Story 3

- [X] T007 [US3] Implementar `api/src/auditoria.ts`: `auditar(cliente, entrada, ahora?)` (valida, construye la entidad del data-model y hace `createEntity`) y `conAuditoria(cliente, entrada, escribir)` que audita primero y solo después escribe

**Checkpoint**: auditoría lista para la carga.

---

## Phase 4: User Story 2 - Sembrar el catálogo desde la semilla (Priority: P1)

**Goal**: carga idempotente, solo altas, auditada con `sistema:carga`.

**Independent Test**: integración en Azurite: vacío → 70 + 70; segunda vez → 0.

### Tests for User Story 2

- [X] T008 [P] [US2] Unitarias en `api/src/farolas.test.ts` del parseo: la semilla real da 70 farolas `F01`–`F70` (F62 incluida); se detiene en la línea en blanco; rechaza cabecera distinta, recuento ≠ 70, id repetido o fuera de 1–70, lat fuera de 37.30–37.33, lon fuera de −5.98 a −5.95, `posicion` distinta de `verificada`/`estimada`, comillas; el error nombra la línea
- [X] T009 [P] [US2] Integración en `api/src/carga-farolas.integration.test.ts` (Azurite, tablas temporales): vacío → 70 farolas y 70 entradas `farola.alta` con actor `sistema:carga` y sin `antes`; segunda carga → 0 altas y 0 entradas nuevas; farola existente con otra posición no se toca; con algunas ya cargadas solo da de alta las que faltan

### Implementation for User Story 2

- [X] T010 [US2] Implementar `parsearSemilla(texto)` y el tipo `Farola` en `api/src/farolas.ts` según el data-model (`PartitionKey` `farola`, `RowKey` `Fnn`, `calle`, `lat`, `lon`, `precision`)
- [X] T011 [US2] Implementar `cargarFarolas({ farolas, auditoria }, semilla)` en `api/src/carga-farolas.ts`: lista claves existentes, y por cada farola que falta `conAuditoria(..., () => createEntity(...))`; devuelve `{ altas, existentes }`
- [X] T012 [US2] Punto de entrada `api/src/scripts/cargar-farolas.ts`: lee la ruta del CSV (argumento), usa `tablaClient`, imprime solo recuentos y sale con código ≠ 0 si falla
- [X] T013 [US2] Workflow `.github/workflows/cargar-farolas.yml`: `workflow_dispatch`, solo `refs/heads/main`, entorno `infra`, `permissions: contents read, id-token write`, mismas acciones fijadas por SHA que `infra.yml`; obtiene la cuenta `stbuenavista*` y su clave (enmascarada), genera SAS de servicio de 1 h (`Farolas: ra`, `Auditoria: a`, HTTPS) enmascarados, ejecuta el script y escribe el recuento en el resumen

**Checkpoint**: el catálogo se puede sembrar en cualquier entorno.

---

## Phase 5: User Story 1 - Consultar el catálogo de farolas (Priority: P1)

**Goal**: `GET /api/farolas` según `contracts/get-farolas.md`.

**Independent Test**: unitarias con cliente simulado + integración con el SAS `r`.

### Tests for User Story 1

- [X] T014 [P] [US1] Unitarias en `api/src/farolas.test.ts`: respuesta `{ farolas: [{ id, calle, lat, lon }] }` ordenada por id, sin `precision` ni campos de Table; `Cache-Control: public, max-age=300`; catálogo vacío → lista vacía; fallo del cliente → 500 genérico con `no-store`

### Implementation for User Story 1

- [X] T015 [US1] Implementar `listarFarolas(cliente)` y `respuestaFarolas(cliente)` en `api/src/farolas.ts`
- [X] T016 [US1] Registrar la Function anónima `GET /api/farolas` en `api/src/functions/farolas.ts` (sin registrar la cadena de conexión en el log de error)

**Checkpoint**: catálogo consultable.

---

## Phase 6: Permisos de las credenciales (US1 + US3)

- [X] T017 [US3] Sustituir la prueba del SAS de cuenta de `api/src/tables.integration.test.ts` por SAS de servicio por tabla (`generateTableSas`): con `Farolas: r` se consulta pero no se crea ni actualiza; con `Auditoria: ra` se añade y se lee, pero actualizar y borrar dan 403; ninguno crea ni borra tablas

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T018 [P] `infra/README.md`: SAS por tabla (permisos, caducidad, rotación), workflow "Cargar farolas" y orden de despliegue infra → carga → app
- [X] T019 [P] `docs/producto.md`: F62 como farola normal (nota de que sus coordenadas son inferidas, ±20 m); reubicar (`PUT`) y crear (`POST`) farola por la directiva en el cambio 8
- [X] T020 [P] `docs/roadmap.md`: cambio 2 con SAS por tabla y carga por workflow; cambio 8 ampliado con `POST /api/farolas`
- [X] T021 [P] `docs/decisions/registro.md`: decisión del 2026-11-15 (opción A, carga como siembra solo de altas, F62 normal, `PUT`/`POST` en el cambio 8)
- [X] T022 Build y tests en `api/` y `web/`; revisión con `revisar-seguridad`

---

## Dependencies & Execution Order

- Setup (T001–T002) → Foundational (T003–T005) → US3 (T006–T007) → US2 (T008–T013) → US1 (T014–T016) → T017 → Polish.
- US1 solo depende de Foundational para el código; para tener datos en un entorno necesita US2.
- US2 depende de US3 (`conAuditoria`).

### Parallel Opportunities

- T001 y T002; T005 con T003 terminado; T006, T008, T009 y T014 (ficheros distintos); T018–T021.

## Implementation Strategy

1. Setup + Foundational + US3 (auditoría): base reutilizable por los cambios siguientes.
2. US2: el catálogo se puede sembrar.
3. US1: el catálogo se puede consultar (MVP visible para el mapa del cambio 3).
4. Permisos, documentación y verificación en Azure (quickstart).
