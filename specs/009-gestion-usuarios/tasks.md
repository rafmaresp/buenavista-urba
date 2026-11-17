---

description: "Tareas de la gestión de usuarios por la directiva"
---

# Tasks: Gestión de usuarios por la directiva

**Input**: Design documents from `/specs/009-gestion-usuarios/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-usuarios.md

**Tests**: obligatorios por la constitución (III y V): unitarias, integración contra Azurite y e2e.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Cambiar el SAS de `Usuarios` de la app de `signedPermission: 'ru'` a `'raud'` con el comentario del motivo (research R2) en infra/main.bicep

## Phase 2: Foundational

- [X] T002 Exportar `esEmailValido(email)` (la forma `FORMA_EMAIL` que ya usa `parsearAltas`) y reutilizarla en `parsearAltas` en api/src/usuarios.ts
- [X] T003 Ampliar `ClienteTablaUsuarios` con `getEntity` y un `updateEntity` Merge genérico (`sub`, `rol`, `estado`, `baja`), y añadir `listar()` (sin `estado = suprimido`) y `leer(uid)` a `RepositorioUsuarios` en api/src/usuarios-repo.ts
- [X] T004 Adaptar los dobles (`getEntity`, `updateEntity` con campos y ETag) en api/src/pruebas/usuarios-dobles.ts
- [X] T005 Crear api/src/usuarios-http.ts con la vista `{uid, email, rol, estado, vinculado, propio}`, el guardián común (identificar + rol `directiva`, si no 403 `sin-acceso`) y `respuestaListar` (200 ordenada por correo, `Cache-Control: no-store`)
- [X] T006 Registrar GET/POST `usuarios` y PATCH `usuarios/{uid}` con `depsIdentidad` en api/src/functions/usuarios.ts

## Phase 3: User Story 1 - Dar de alta (P1) 🎯 MVP

**Goal**: la directiva da de alta un correo con rol. **Independent Test**: POST crea fila activa auditada; repetido → 409.

- [X] T007 [US1] `validarAlta(cuerpo)`: solo claves `email` y `rol`, correo normalizado con `normalizarEmail` y `esEmailValido`, rol `comunero|directiva`, en api/src/usuarios.ts
- [X] T008 [US1] `respuestaAlta`: 400 `peticion-no-valida`, 409 `ya-existe` si `buscarPorEmail` devuelve filas, 201 con la vista tras `RepositorioUsuarios.crear(alta, uidDirectiva)`, 503 `no-disponible` (solo nombre y código en el log) en api/src/usuarios-http.ts
- [X] T009 [P] [US1] Unitarias de alta y listado (rol, 403 a comunero, validación, 409, auditoría `usuario.alta` con actor uid y sin correo, 503 y borrado si la auditoría falla, nunca `sub` en la respuesta) en api/src/usuarios-http.test.ts

## Phase 4: User Story 2 - Baja y reactivación (P1)

**Goal**: `estado` entre `activo` y `baja`. **Independent Test**: tras la baja, `identificar` responde 403; tras reactivar, entra.

- [X] T010 [US2] `RepositorioUsuarios.cambiar(uid, {rol?, estado?}, actor)`: lee; `UsuarioNoEncontrado` si no existe o está suprimido; sin cambios no escribe; Merge con ETag (`baja` = fecha ISO al dar de baja, '' al reactivar); 412 → `UsuarioCambiado`; audita `usuario.cambio` con antes/después `{rol, estado}`; si la auditoría falla restaura `{rol, estado, baja}` y, si no puede, lanza `CambioUsuarioSinAuditar`, en api/src/usuarios-repo.ts
- [X] T011 [US2] `validarCambio(cuerpo)` (`rol?`, `estado?` en `activo|baja`, al menos uno, sin otras claves) en api/src/usuarios.ts y `respuestaCambiar`: uid con forma de UUID, 409 `propio-usuario`, 404 `no-encontrado`, 409 `usuario-cambiado`, 503, 200 con la vista, en api/src/usuarios-http.ts
- [X] T012 [P] [US2] Unitarias del repositorio (`cambiar`: entrada de auditoría, deshacer, 412, suprimido, sin cambios) en api/src/usuarios-repo.test.ts y de `respuestaCambiar` en api/src/usuarios-http.test.ts
- [X] T013 [US2] Integración con el SAS `raud`: alta, baja y reactivación auditadas; la app no puede borrar la tabla ni tocar Auditoria más allá de añadir, en api/src/usuarios.integration.test.ts

## Phase 5: User Story 3 - Cambiar rol (P2)

**Goal**: rol entre comunero y directiva; nunca el propio. **Independent Test**: PATCH `{rol}` cambia el rol auditado; sobre uno mismo, 409.

- [X] T014 [US3] Casos de rol en las unitarias de api/src/usuarios-http.test.ts y api/src/usuarios-repo.test.ts (cubiertos por `cambiar` de T010)

## Phase 6: Web y e2e (US1–US3)

- [X] T015 [P] Cliente `listarUsuarios`, `altaUsuario`, `cambiarUsuario` con validación de la respuesta y errores tipados en web/src/app/usuarios/usuarios-cliente.ts (+ .spec.ts)
- [X] T016 Componente perezoso `/usuarios`: tabla (correo, rol, estado, "ha entrado"), formulario de alta, selector de rol y botón Dar de baja/Reactivar ocultos en la fila `propio`; mensaje para quien no es directiva; mensajes de 409/503, en web/src/app/usuarios/usuarios.ts y usuarios.html (+ .spec.ts)
- [X] T017 Ruta `usuarios` en web/src/app/app.routes.ts y enlace "Usuarios" solo para `directiva` en web/src/app/app.html
- [X] T018 [P] e2e con la API simulada (alta, baja, cambio de rol, fila propia sin controles, comunero sin enlace) en e2e/tests/usuarios.spec.ts

## Phase 7: Polish

- [X] T019 [P] Actualizar quién gestiona la lista en docs/producto.md, el cambio 4d en docs/roadmap.md, la decisión en docs/decisions/registro.md y "Quién ve qué" en web/src/app/privacidad/privacidad.html
- [X] T020 Build y tests de api/ y web/; skill `revisar-seguridad` sobre api/, infra/ y la pantalla

## Dependencies & Execution Order

- T001 independiente. T002–T006 bloquean las historias. US1 (T007–T009) es el MVP. US2 (T010–T013) depende de T003–T004. US3 reutiliza `cambiar`. Web (T015–T018) depende del contrato, no del código de la API.

## Parallel Example

```text
T009, T012 (tests de api) en paralelo con T015 y T018 (web y e2e).
```

## Implementation Strategy

MVP = US1 (alta). Después US2 (baja), US3 (rol) y la web completa en el mismo PR (flujo ligero).
