---

description: "Tareas del cambio mapa-farolas"
---

# Tasks: Mapa de farolas en solo lectura

**Input**: Design documents from `/specs/004-mapa-farolas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: pedidos en la spec (unitarios con Vitest y e2e con Playwright).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Phase 1: Setup

- [ ] T001 Añadir `leaflet@1.9.4` (dependencia) y `@types/leaflet` (desarrollo) en web/package.json y web/package-lock.json
- [ ] T002 [P] Añadir `node_modules/leaflet/dist/leaflet.css` antes de `src/styles.css` en `styles` de web/angular.json
- [ ] T003 [P] Ampliar la CSP en web/public/staticwebapp.config.json a `default-src 'self'; img-src 'self' data: https://www.ign.es https://tile.openstreetmap.org`

---

## Phase 2: Foundational

- [ ] T004 [P] Definir capas PNOA (por defecto, "PNOA © IGN") y OSM ("© OpenStreetMap", `https://tile.openstreetmap.org/{z}/{x}/{y}.png`), centro 37.3165, -5.9606, zoom 17, `maxZoom` 20, `maxNativeZoom` 19 y zoom de etiquetas 18 en web/src/app/mapa/capas.ts
- [ ] T005 [P] Test de `cargarFarolas` en web/src/app/mapa/farolas-cliente.spec.ts: 200 válido, `farolas: []`, estado ≠ 200, error de red, cuerpo sin array, elemento con `id` que no cumple `^F\d{2}$`, `calle` vacía, `lat`/`lon` no finitos
- [ ] T006 Implementar `cargarFarolas(fetchFn)` y el tipo `FarolaPublica` en web/src/app/mapa/farolas-cliente.ts según data-model.md (`id` `^F\d{2}$`, `calle` no vacía, `lat`/`lon` finitos; cualquier fallo lanza `ErrorCargaFarolas`)

---

## Phase 3: User Story 1 - Ver las farolas sobre el mapa (Priority: P1) 🎯 MVP

**Goal**: mapa a pantalla completa centrado en Buenavista I con una marca por farola.

**Independent Test**: abrir `/` y contar 70 marcas `farola-marca`.

- [ ] T007 [P] [US1] Fixture e2e con las 70 farolas leídas de data/farolas_buenavista.csv (sin `precision`) y helper que intercepta `/api/farolas` y las teselas externas en e2e/tests/farolas.fixture.ts
- [ ] T008 [P] [US1] e2e de carga: título, región "Mapa de farolas", 70 marcas, sin errores de consola (CSP) en e2e/tests/mapa.spec.ts
- [ ] T009 [P] [US1] Test del componente con `cargarFarolas` falso: crea el mapa y pinta una marca por farola con título `Farola Fnn` en web/src/app/mapa/mapa-farolas.spec.ts
- [ ] T010 [US1] Componente standalone `app-mapa-farolas` (web/src/app/mapa/mapa-farolas.ts y .html): crea el mapa en `afterNextRender`, marcas `L.marker` + `L.divIcon` con punto y etiqueta (contenido con `textContent`), clase `mapa--etiquetas` desde zoom 18, `remove()` en `ngOnDestroy`
- [ ] T011 [US1] Estilos globales en web/src/styles.css: pantalla completa (móvil primero), cabecera fina, marca y etiqueta, sin estilos de componente
- [ ] T012 [US1] Sustituir "En construcción" por `<app-mapa-farolas>` en web/src/app/app.html y web/src/app/app.ts, y actualizar web/src/app/app.spec.ts

---

## Phase 4: User Story 2 - Consultar una farola (Priority: P2)

**Goal**: ficha con código y calle al tocar una marca.

**Independent Test**: tocar F01 y ver "F01" y su calle.

- [ ] T013 [P] [US2] e2e: tocar F01 → ficha con "F01" y su calle; tocar otra → la ficha cambia, en e2e/tests/mapa.spec.ts
- [ ] T014 [P] [US2] Test unitario de `contenidoFicha(farola)`: encabezado con el código y calle como texto, sin interpretar HTML, en web/src/app/mapa/mapa-farolas.spec.ts
- [ ] T015 [US2] `contenidoFicha` y `bindPopup` en cada marca en web/src/app/mapa/mapa-farolas.ts

---

## Phase 5: User Story 3 - Cambiar entre ortofoto y callejero (Priority: P3)

**Goal**: selector de capas con atribución.

**Independent Test**: elegir "Callejero" y ver "© OpenStreetMap".

- [ ] T016 [P] [US3] e2e: "Ortofoto" marcada por defecto con "PNOA © IGN"; elegir "Callejero" muestra "© OpenStreetMap", en e2e/tests/mapa.spec.ts
- [ ] T017 [US3] `L.control.layers` desplegado con "Ortofoto" y "Callejero" en web/src/app/mapa/mapa-farolas.ts

---

## Phase 6: User Story 4 - Saber que algo ha fallado (Priority: P3)

**Goal**: aviso de error con "Reintentar"; indicador de carga.

**Independent Test**: `/api/farolas` con 500 → aviso; reintentar con 200 → 70 marcas.

- [ ] T018 [P] [US4] e2e: 500 → `alert` "No se pudieron cargar las farolas"; "Reintentar" con la API ya bien → 70 marcas y sin aviso, en e2e/tests/mapa.spec.ts
- [ ] T019 [P] [US4] Test del componente: estado `cargando` con `status`, `error` con `alert` y reintento que pinta las farolas, en web/src/app/mapa/mapa-farolas.spec.ts
- [ ] T020 [US4] Estados `cargando`/`ok`/`error` con signals, `status` "Cargando farolas…", `alert` con botón "Reintentar" en web/src/app/mapa/mapa-farolas.ts y .html

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T021 [P] Actualizar el comentario de e2e/tests/smoke.spec.ts si cambia lo que comprueba la página principal
- [ ] T022 Build y tests en verde en web/ y api/, e2e en verde, presupuesto del bundle sin error
- [ ] T023 Skill `revisar-seguridad` sobre la CSP y el contenido de la ficha (sin HTML interpolado)

---

## Dependencies & Execution Order

- Setup (T001–T003) → Foundational (T004–T006) → US1 → US2/US3/US4 (independientes entre sí, todas sobre el componente de US1) → Polish.
- Dentro de cada historia: tests antes que implementación.

### Parallel Opportunities

- T002 y T003; T004 y T005; T007, T008 y T009; los tests de cada historia entre sí.

```text
# US1 en paralelo
T007 fixture e2e · T008 e2e de carga · T009 test del componente
```

## Implementation Strategy

1. MVP = US1 (mapa con 70 marcas). Validar con el e2e de carga.
2. US2 (ficha), US3 (capas) y US4 (error) sobre el mismo componente.
3. Un único PR (flujo ligero), tamaño M.
