---

description: "Tareas de reubicar farola (directiva)"
---

# Tasks: Reubicar farola (directiva)

**Input**: Design documents from `specs/008-reubicar-farola/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/put-farola.md

**Tests**: obligatorios por la constitución (III y V): unitarias, integración contra Azurite y e2e.

**Organization**: por historia de usuario (US1 reubicar, US2 cancelar o fallar, US3 solo directiva).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (otro archivo, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1, US2, US3)

## Phase 1: Setup

- [X] T001 Ampliar el SAS de la app sobre `Farolas` de `signedPermission: 'r'` a `'ru'` y actualizar el comentario en infra/main.bicep
- [X] T002 [P] Actualizar la expectativa de permisos (`tablaFarolas: 'ru'`) y el nombre del test en api/src/tablas.test.ts

---

## Phase 2: Foundational

- [X] T003 Exportar los límites de la urbanización (`LAT` 37,30–37,33 y `LON` −5,98–−5,95), un `ID_FAROLA = /^F\d{2}$/` y `validarReubicacion(cuerpo): {lat, lon} | undefined` (números finitos dentro de los límites; ignora otros campos) en api/src/farolas.ts
- [X] T004 [P] Tests de `validarReubicacion` (válido, campos de más ignorados, cadenas, NaN, fuera de rango, nulo, no objeto) en api/src/farolas.test.ts

---

## Phase 3: User Story 1 - La directiva corrige la posición de una farola (P1) 🎯 MVP

**Goal**: `PUT /api/farolas/{id}` reubica y audita; la web permite mover, confirmar y guardar.

**Independent Test**: mover una farola con sesión de directiva, guardar, y ver la posición nueva y la entrada `farola.reubicacion`.

### Tests for User Story 1

- [X] T005 [P] [US1] Tests de `RepositorioFarolas.reubicar()` con un doble en memoria: cambia `lat`, `lon` y `precision = verificada` con `Merge` y el ETag leído; entrada `farola.reubicacion` con antes/después `{lat, lon, precision}` y actor uid; 404 → `FarolaNoEncontrada`; 412 → `FarolaCambiada` sin auditar; en api/src/farolas-repo.test.ts
- [X] T006 [P] [US1] Tests de `respuestaReubicar()` para el caso 200 (cuerpo `{farola: {id, calle, lat, lon}}` sin precisión, `no-store`) y los errores 400, 404, 409 y 503 sin registrar el cuerpo en api/src/farolas-http.test.ts
- [X] T007 [P] [US1] Integración contra Azurite con el SAS `ru` de la app (y `ra` de Auditoria): reubica y audita; un ETag antiguo da `FarolaCambiada` y no pisa en api/src/farolas-reubicar.integration.test.ts
- [X] T008 [P] [US1] Tests de `reubicarFarola()` (PUT con JSON `{lat, lon}`, 200 válido, mapeo de 401/403 → `sin-sesion`, 409 → `cambiada`, 400/404 → `no-valido`, resto → `no-disponible`) en web/src/app/mapa/farolas-cliente.spec.ts
- [X] T009 [P] [US1] Tests del componente: con rol directiva la ficha muestra "Mover", la marca se arrastra, al soltar sale "¿Mover F01 aquí?" y Guardar llama a `reubicar` con la nueva posición y deja la marca en ella, en web/src/app/mapa/mapa-farolas.spec.ts

### Implementation for User Story 1

- [X] T010 [US1] Ampliar `ClienteTablaFarolas` con `getEntity` y `updateEntity`, e implementar `reubicar(id, {lat, lon}, actor)` con `FarolaNoEncontrada`, `FarolaCambiada` y `ReubicacionSinAuditar` en api/src/farolas-repo.ts
- [X] T011 [US1] Implementar `respuestaReubicar(id, cabeceras, leerCuerpo, identidad, deps)` (orden: identidad → rol → id y cuerpo → repositorio) en api/src/farolas-http.ts
- [X] T012 [US1] Registrar la Function `PUT farolas/{id}` (anónima a nivel SWA, identifica en cada petición) en api/src/functions/farolas.ts
- [X] T013 [US1] Implementar `reubicarFarola(llamar, id, lat, lon)` y `ErrorReubicar` en web/src/app/mapa/farolas-cliente.ts
- [X] T014 [US1] Botón "Mover" en la ficha (solo si se pasa `mover`), modo mover con `marker.dragging`, barra de confirmación con Guardar y Cancelar e input inyectable `reubicar` en web/src/app/mapa/mapa-farolas.ts y web/src/app/mapa/mapa-farolas.html
- [X] T015 [P] [US1] Estilos de la barra de mover y del botón "Mover" en web/src/styles.css

**Checkpoint**: la directiva mueve y guarda; queda auditado.

---

## Phase 4: User Story 2 - Cancelar o fallar no mueve nada (P1)

**Goal**: Cancelar o cualquier error devuelven la marca; la auditoría fallida restaura la farola.

**Independent Test**: cancelar tras arrastrar y simular errores del servidor; la marca vuelve y el catálogo no cambia.

### Tests for User Story 2

- [X] T016 [P] [US2] Tests del repositorio: si la auditoría falla se restaura la posición y precisión anteriores con el ETag de la propia escritura y se propaga el error; si restaurar falla, `ReubicacionSinAuditar`; en api/src/farolas-repo.test.ts
- [X] T017 [P] [US2] Integración: con el SAS de Auditoria sin `a`, la reubicación falla con 403 y la farola sigue en su sitio, en api/src/farolas-reubicar.integration.test.ts
- [X] T018 [P] [US2] Tests del componente: Cancelar antes y después de soltar devuelve la marca sin llamar a `reubicar`; un error `sin-sesion`, `cambiada` o `no-disponible` devuelve la marca y muestra su mensaje, en web/src/app/mapa/mapa-farolas.spec.ts

### Implementation for User Story 2

- [X] T019 [US2] Restauración y mensajes de error por motivo en web/src/app/mapa/mapa-farolas.ts (la parte del repositorio va en T010)

---

## Phase 5: User Story 3 - Solo la directiva puede mover farolas (P1)

**Goal**: sin rol directiva no hay control en la web y la API rechaza.

**Independent Test**: PUT sin token (401), con comunero (403) y con directiva (200).

### Tests for User Story 3

- [X] T020 [P] [US3] Tests de `respuestaReubicar()`: sin token 401 sin tocar la tabla; comunero 403 `sin-acceso` sin leer ni escribir `Farolas` ni auditar; en api/src/farolas-http.test.ts
- [X] T021 [P] [US3] Tests del componente: sin sesión y con rol comunero la ficha no muestra "Mover" en web/src/app/mapa/mapa-farolas.spec.ts
- [X] T022 [US3] e2e: login simulado de directiva (GIS falso, `/api/config`, `/api/yo`), mover F07 arrastrando, confirmar con `PUT` simulado y comprobar el cuerpo; Cancelar devuelve la marca; sin sesión no hay "Mover"; el `PUT` real sin token da 401; con `entrarComoDirectiva()` en e2e/tests/farolas.fixture.ts y e2e/tests/reubicar.spec.ts

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T023 [P] Documentar el cambio de permiso del SAS de `Farolas` en infra/README.md
- [X] T024 [P] Marcar en docs/roadmap.md que el cambio `reubicar-farola` se parte: reubicar en `specs/008-reubicar-farola/`; `POST` y precisión para la directiva quedan pendientes
- [X] T025 [P] Añadir la decisión (reubicar sin `POST`, precisión `verificada`, SAS `ru`) al final de docs/decisions/registro.md
- [X] T026 Revisión con la skill `revisar-seguridad` sobre api/, infra/ y el mapa
- [X] T027 Build y tests en verde en web/ y api/ (y e2e) según quickstart.md

---

## Dependencies & Execution Order

- Setup (T001–T002) y Foundational (T003–T004) antes de las historias.
- US1 (T005–T015) es el MVP; US2 y US3 amplían los mismos archivos y dependen de T010, T011 y T014.
- Polish al final.

### Parallel Opportunities

- T004, T005, T006, T007, T008 y T009 (tests de archivos distintos) en paralelo.
- T013 y T015 en paralelo con T010–T012 (web frente a API).
- T023, T024 y T025 en paralelo.

## Parallel Example: User Story 1

```text
T005 farolas-repo.test.ts · T006 farolas-http.test.ts · T008 farolas-cliente.spec.ts · T009 mapa-farolas.spec.ts
```

## Implementation Strategy

1. Setup + Foundational.
2. US1 (API y web) → validar con unitarias e integración.
3. US2 y US3 → e2e.
4. Polish, revisión de seguridad, build y tests.

## Phase 7: Convergence

- [X] T028 Registrar la Function `PUT farolas/{id}` en su propio archivo api/src/functions/farola-reubicar.ts en lugar de api/src/functions/farolas.ts, para que `functions.test.ts` (que exime a `farolas.ts` por ser pública) compruebe que usa `depsIdentidad` per plan: Project Structure y Constitution IV (contradicts)
