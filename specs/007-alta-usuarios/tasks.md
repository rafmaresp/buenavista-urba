---

description: "Tareas del cambio 007-alta-usuarios"
---

# Tasks: Alta de usuarios en la lista cerrada

**Input**: Design documents from `/specs/007-alta-usuarios/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: obligatorios por la constitución (III y V): unitarias e integración contra Azurite.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Crear `.specify/feature.json` con `{"feature_directory":"specs/007-alta-usuarios"}` (no se sube)

## Phase 2: Foundational

- [X] T002 Añadir `createEntity(entity)` y `deleteEntity(partitionKey, rowKey)` a `ClienteTablaUsuarios` en `api/src/usuarios-repo.ts` y al doble `tablaUsuarios` en `api/src/pruebas/usuarios-dobles.ts` (con opción `altaFalla`/`deshacerFalla` y registro en `orden`)
- [X] T003 [P] Añadir `parsearAltas(texto): { altas: {email, rol}[] } ` en `api/src/usuarios.ts`: recorta, ignora líneas en blanco, `normalizarEmail()`, correo con forma `algo@dominio.tld` sin espacios ni comas, rol `comunero` o `directiva`, sin repetidos tras normalizar; lanza `AltasInvalidas` con `Línea L: <motivo>` por cada error y nunca el contenido de la línea

## Phase 3: User Story 1 - Rafa queda dado de alta como directiva (P1) 🎯 MVP

**Goal**: una línea válida crea un usuario activo auditado.

**Independent Test**: carga con una línea `directiva` sobre tabla vacía ⇒ fila con correo normalizado, `sub` vacío, estado `activo` y auditoría `usuario.alta` sin correo.

- [X] T004 [P] [US1] Tests de `RepositorioUsuarios.crear` en `api/src/usuarios-repo.test.ts`: fila con `rowKey` UUID v4, `email` normalizado, `sub: ''`, `estado: 'activo'`, `alta` ISO, `baja: ''`; auditoría `usuario.alta`, actor `sistema:carga`, clave uid, antes `null`, después `{rol, estado}` sin correo; si la auditoría falla se borra la fila y se propaga el error; si además el borrado falla lanza `AltaUsuarioSinAuditar` sin correo
- [X] T005 [US1] Implementar `emails()` (Set de correos de la partición `usuario`, `select: ['email']`) y `crear({email, rol}, actor)` con `randomUUID()` y la clase `AltaUsuarioSinAuditar` en `api/src/usuarios-repo.ts`
- [X] T006 [P] [US1] Tests de `cargarUsuarios` en `api/src/carga-usuarios.test.ts` (alta de los que faltan con actor `ACTOR_CARGA`)
- [X] T007 [US1] Implementar `cargarUsuarios(repo, altas): {altas: number, existentes: number}` en `api/src/carga-usuarios.ts` reutilizando `ACTOR_CARGA` de `api/src/carga-farolas.ts`
- [X] T008 [US1] Script `api/src/scripts/cargar-usuarios.ts`: lee `USUARIOS_ALTA`, valida, carga e imprime `Lista: N usuarios. Ya existían: E. Altas: A.`; errores solo con nombre y código (como `cargar-farolas.ts`)
- [X] T009 [US1] Workflow `.github/workflows/infra-desplegar.yml`: secreto opcional `USUARIOS_ALTA` en `workflow_call`, SAS de 1 h `Usuarios rad` enmascarado y `USUARIOS_CONNECTION` en el paso de SAS, paso "Cargar usuarios (solo altas)" con `env: USUARIOS_ALTA` y salida al resumen; `.github/workflows/azure-swa.yml` pasa `USUARIOS_ALTA`

## Phase 4: User Story 2 - Relanzar no duplica ni cambia a nadie (P1)

**Independent Test**: dos cargas seguidas ⇒ la segunda da 0 altas y ninguna auditoría; un existente con otro rol no cambia.

- [X] T010 [P] [US2] Tests en `api/src/carga-usuarios.test.ts`: existente (cualquier estado, distinto rol) cuenta como existente sin escritura; lista vacía ⇒ 0 altas
- [X] T011 [US2] Script: secreto vacío o ausente ⇒ `Sin USUARIOS_ALTA: no se da de alta a nadie.` y código 0, sin abrir tablas, en `api/src/scripts/cargar-usuarios.ts`
- [X] T012 [US2] Integración `api/src/carga-usuarios.integration.test.ts` contra Azurite con SAS `rad` en `Usuarios` y `a` en `Auditoria`: alta, relanzar da 0 altas y una sola entrada de auditoría

## Phase 5: User Story 3 - Ningún correo sale del secreto (P1)

**Independent Test**: salidas, errores y auditoría sin correos.

- [X] T013 [P] [US3] Tests de `parsearAltas` en `api/src/usuarios.test.ts`: cada motivo (sin coma, correo no válido, rol desconocido, repetido con otra mayúscula) con su número de línea y sin el contenido; blancos ignorados
- [X] T014 [US3] Comprobar en la integración (T012) que ninguna entrada de `Auditoria` contiene `@`

## Phase 6: Polish & Cross-Cutting

- [X] T015 [P] `infra/README.md`: sección "Alta de usuarios" (secreto `USUARIOS_ALTA`, lanzar a mano, SAS `rad` solo en la carga)
- [X] T016 [P] `docs/roadmap.md`: fila 4c pasa a "alta" (hecho en `specs/007-alta-usuarios/`) y nueva fila 4d con baja, supresión, cambio de rol, registro de actividades y nota EIPD
- [X] T017 [P] `docs/decisions/registro.md`: entrada "Alta de usuarios por secreto en el despliegue de infra"
- [X] T018 Skill `revisar-seguridad` sobre el diff; `npm run build` y `npm test` en `api/` (con Azurite) y `web/`

## Dependencies & Execution Order

- T002 y T003 antes de las historias. US1 (T004–T009) antes de US2 y US3, que reutilizan el repo y el script.
- [P] dentro de cada fase: ficheros distintos.

## Implementation Strategy

MVP = US1 (Rafa entra como directiva); US2 y US3 son garantías del mismo PR, tamaño S.
