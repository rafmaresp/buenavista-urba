---

description: "Tareas de la feature Aviso de mantenimiento programado en el mapa"
---

# Tasks: Aviso de mantenimiento programado en el mapa

**Input**: Design documents from `/specs/003-aviso-mantenimiento/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/aviso.openapi.yaml

**Tests**: Obligatorios por la constitución (Principio V) y por la auditoría (Principio III).

**Organization**: Tareas agrupadas por historia de usuario para implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (ficheros distintos, sin dependencias)
- **[Story]**: historia de usuario (US1, US2, US3)

## Path Conventions

Aplicación web: `api/src/`, `api/tests/`, `web/src/app/`, `infra/`. Las rutas se ajustan a lo que dejen los cambios 3 (mapa) y 4 (login y roles).

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Comprobar prerrequisitos y declarar la tabla

- [ ] T001 Comprobar que existen el mapa (cambio 3) y el login con roles (cambio 4) y localizar los helpers de rol, `auditar()` y acceso a Table Storage en `api/src/` para reutilizarlos
- [ ] T002 Declarar la tabla `Avisos` en `infra/` (Bicep) y añadirla a la lista de tablas que contrasta la integración contra Azurite

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lógica compartida por las tres historias

**⚠️ CRITICAL**: Ninguna historia empieza hasta terminar esta fase

- [ ] T003 Crear en `api/src/lib/aviso.ts` el tipo `Aviso` y la validación según `data-model.md`: `texto` obligatorio, recortado, "1–140 caracteres", sin interpretar HTML; `fechaHora` ISO 8601 válida y posterior al instante de publicar
- [ ] T004 [P] Tests unitarios de la validación y de la caducidad en `api/tests/aviso.test.ts` (texto vacío, 141 caracteres, fecha pasada, fecha futura)
- [ ] T005 Añadir en `api/src/lib/aviso.ts` el acceso a la tabla `Avisos` (clave fija `aviso`/`vigente`): leer, sustituir (upsert) y borrar

**Checkpoint**: validación y acceso a datos probados

---

## Phase 3: User Story 1 - Ver el aviso vigente en el mapa (Priority: P1) 🎯 MVP

**Goal**: Cualquier visitante ve el banner hasta que pasa la fecha

**Independent Test**: con un aviso sembrado en Azurite, abrir el mapa sin sesión y ver el banner; con fecha pasada o sin aviso, no hay banner

### Tests for User Story 1

- [ ] T006 [P] [US1] Test de integración de `GET /api/aviso` contra Azurite en `api/tests/aviso.integration.test.ts`: 200 con aviso vigente, 204 sin aviso o caducado, sin campo de autor, cabecera `Cache-Control: public, max-age=60`
- [ ] T007 [P] [US1] Test del componente del banner en `web/src/app/aviso/aviso-banner.component.spec.ts`: muestra fecha en Europa/Madrid y texto como texto plano; no pinta nada con 204 ni con error de red

### Implementation for User Story 1

- [ ] T008 [US1] Implementar `GET /api/aviso` anónimo en `api/src/functions/aviso.ts` con caducidad calculada en servidor (FR-001, FR-002, FR-007)
- [ ] T009 [P] [US1] Crear el servicio de lectura en `web/src/app/aviso/aviso.service.ts` que ignora los fallos (FR-003)
- [ ] T010 [US1] Crear `web/src/app/aviso/aviso-banner.component.ts` e integrarlo en la página del mapa en `web/src/app/mapa/`
- [ ] T011 [US1] e2e con Playwright en `web/e2e/aviso.spec.ts`: el visitante anónimo ve y deja de ver el banner

**Checkpoint**: la lectura funciona y es demostrable con un aviso sembrado

---

## Phase 4: User Story 2 - La directiva publica un aviso (Priority: P2)

**Goal**: La directiva publica o sustituye el aviso y lo ven todos

**Independent Test**: como directiva, publicar con fecha futura y verlo como visitante; comunero y anónimo reciben rechazo

### Tests for User Story 2

- [ ] T012 [P] [US2] Tests de integración de `PUT /api/aviso` en `api/tests/aviso.integration.test.ts`: 200 directiva, 403 comunero, 401 sin token, 400 texto o fecha inválidos, sustitución del aviso anterior
- [ ] T013 [P] [US2] Test de la entrada de auditoría de `aviso.publicar` en `api/tests/aviso.audit.test.ts`: actor `uid`, antes y después `{presente, longitud, fechaHora}`, sin el texto ni email

### Implementation for User Story 2

- [ ] T014 [US2] Implementar `PUT /api/aviso` en `api/src/functions/aviso.ts`: rol directiva comprobado en servidor (FR-004), validación (FR-006) y `auditar()` en la misma operación (FR-008)
- [ ] T015 [P] [US2] Crear el formulario de directiva en `web/src/app/aviso/aviso-form.component.ts` (fecha, hora local, texto con contador de 140 y aviso de no escribir datos de terceros), visible solo para directiva (FR-010)
- [ ] T016 [US2] Conectar el formulario con `PUT /api/aviso` en `web/src/app/aviso/aviso.service.ts` y mostrar errores de validación
- [ ] T017 [US2] Ampliar `web/e2e/aviso.spec.ts`: la directiva publica y el visitante lo ve; el comunero no ve el formulario

**Checkpoint**: US1 y US2 funcionan de extremo a extremo

---

## Phase 5: User Story 3 - La directiva quita un aviso (Priority: P3)

**Goal**: La directiva retira el aviso antes de su fecha

**Independent Test**: quitar el aviso como directiva y ver desaparecer el banner; un comunero no puede

### Tests for User Story 3

- [ ] T018 [P] [US3] Tests de integración de `DELETE /api/aviso` en `api/tests/aviso.integration.test.ts`: 204 directiva (también si no existe), 403 comunero, 401 sin token
- [ ] T019 [P] [US3] Test de la entrada de auditoría de `aviso.quitar` en `api/tests/aviso.audit.test.ts`

### Implementation for User Story 3

- [ ] T020 [US3] Implementar `DELETE /api/aviso` en `api/src/functions/aviso.ts` con rol directiva en servidor (FR-005) y auditoría en la misma operación
- [ ] T021 [US3] Añadir el botón "Quitar aviso" en `web/src/app/aviso/aviso-form.component.ts` y la llamada `DELETE` en `web/src/app/aviso/aviso.service.ts`
- [ ] T022 [US3] Ampliar `web/e2e/aviso.spec.ts`: tras quitar el aviso, el visitante no ve el banner

**Checkpoint**: las tres historias funcionan de forma independiente

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T023 [P] Aplicar `revisar-seguridad` a `api/src/functions/aviso.ts` y `infra/` (403 genérico, sin datos personales en logs ni respuestas)
- [ ] T024 [P] Actualizar `docs/producto.md` (el aviso es visible a visitantes y gestionado por la directiva) y añadir la decisión sobre unicidad y conservación al final de `docs/decisions/registro.md`
- [ ] T025 Ejecutar `npm run build` y `npm test` en `api/` y `web/` y validar `specs/003-aviso-mantenimiento/quickstart.md`

---

## Dependencies & Execution Order

- Setup (T001–T002) → Foundational (T003–T005) → historias.
- US1 no depende de las demás (se prueba con un aviso sembrado). US2 y US3 amplían el mismo `api/src/functions/aviso.ts` y `aviso.service.ts`, por lo que van en orden US2 → US3.
- Dentro de cada historia: tests primero, después implementación.

## Parallel Example

Tras T005: T006, T007 y T009 en paralelo (ficheros distintos). Para US2: T012, T013 y T015.

## Implementation Strategy

1. MVP: Setup + Foundational + US1 (aviso sembrado y banner).
2. Añadir US2 (publicar) y validar.
3. Añadir US3 (quitar) y cerrar con la fase de pulido.

Pendiente de Rafa antes de implementar: unicidad del aviso y conservación de caducados (ver `spec.md`).
