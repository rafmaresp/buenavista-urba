---

description: "Task list for feature implementation"
---

# Tasks: Login con Google y roles

**Input**: Design documents from `/specs/005-login-roles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: obligatorios por la constitución V (unitarias, integración con Azurite y e2e).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Phase 1: Setup

- [X] T001 Añadir `google-auth-library` a `api/package.json` y `@angular/router` (misma versión que `@angular/core`) a `web/package.json`, actualizando los lockfiles
- [X] T002 [P] Declarar la tabla `Usuarios` en `infra/main.bicep` con su SAS de servicio `signedPermission: 'ru'`, el app setting `USUARIOS_CONNECTION` y `GOOGLE_CLIENT_ID` desde el parámetro `googleClientId` (en `infra/main.bicepparam`), y añadir `'Usuarios'` a `TABLAS` en `api/src/tablas.ts` y su permiso al test de `api/src/tablas.test.ts`

## Phase 2: Foundational

- [X] T003 [P] Crear `api/src/usuarios.ts`: tipos `Usuario` (`uid`, `email`, `sub`, `rol: 'comunero' | 'directiva'`, `estado: 'activo' | 'baja' | 'suprimido'`, `alta`, `baja`), `PARTICION_USUARIOS = 'usuario'` y `normalizarEmail()` (`trim().toLowerCase()`), con test en `api/src/usuarios.test.ts`
- [X] T004 Crear `api/src/usuarios-repo.ts` con `RepositorioUsuarios`: `buscarPorSub()`, `buscarPorEmail()` (filtro `odata` en la partición `usuario`; devuelve todas las coincidencias) y `vincularSub(uid, sub, etag)` que hace Merge con ETag, audita `usuario.vincular` (actor y clave = uid; antes `{ vinculado: false }`, después `{ vinculado: true }`) y, si la auditoría falla, vuelve a dejar `sub` vacío o lanza `VinculacionSinAuditar`; tests en `api/src/usuarios-repo.test.ts`
- [X] T005 [P] Crear `api/src/limite.ts`: ventana fija de 60 s y 60 peticiones por clave, con reloj inyectable; tests en `api/src/limite.test.ts`

## Phase 3: User Story 1 - Un comunero de la lista entra (P1) 🎯 MVP

**Goal**: con identidad válida y usuario activo, `GET /api/yo` devuelve el rol y la primera vez se vincula el `sub` auditado.

**Independent Test**: `api/src/identidad.test.ts`, `api/src/yo.test.ts` y `api/src/usuarios.integration.test.ts`.

- [X] T006 [US1] Crear `api/src/identidad.ts` con `identificar(peticion, deps)`: lee `X-Id-Token`, verifica con un `VerificadorToken` (por defecto `OAuth2Client.verifyIdToken` con `audience = GOOGLE_CLIENT_ID`), exige `email_verified`, busca por `sub` y si no por email (vincula el `sub`), exige `estado === 'activo'` y rol válido, aplica el límite y devuelve `{ uid, rol }` o `RespuestaHttp` 401/403/429/503 con los cuerpos de `contracts/api.md`
- [X] T007 [P] [US1] Crear `api/src/yo.ts` (handler puro: `200 { rol }`, `no-store`) y `api/src/functions/yo.ts` (`GET /api/yo`), con test en `api/src/yo.test.ts`
- [X] T008 [P] [US1] Crear `api/src/config.ts` y `api/src/functions/config.ts` (`GET /api/config` → `{ googleClientId }`, cacheable 5 min), con test en `api/src/config.test.ts`
- [X] T009 [US1] Tests de `identificar()` en `api/src/identidad.test.ts`: primer login vincula y audita; segundo login por `sub` sin auditoría; directiva; auditoría que falla deshace la vinculación
- [X] T010 [US1] Integración contra Azurite en `api/src/usuarios.integration.test.ts`: con SAS `ru` de `Usuarios` y `ra` de `Auditoria`, la vinculación se guarda y genera una entrada sin email ni `sub`; el SAS `ru` no puede añadir ni borrar usuarios
- [X] T011 [P] [US1] Web: `web/src/app/sesion.ts` (token en una señal en memoria, `rol`, `entrar(token)` que llama a `/api/yo` con `X-Id-Token`, `salir()`), con test en `web/src/app/sesion.spec.ts`
- [X] T012 [US1] Web: router (`web/src/app/app.routes.ts`, `provideRouter` en `app.config.ts`, `<router-outlet>` en `app.html`) y `web/src/app/login/login.ts` que pide `/api/config`, carga `https://accounts.google.com/gsi/client` solo ahí, pinta el botón y muestra "Has entrado como …", "No tienes acceso" o "Inicio de sesión no disponible"; test en `web/src/app/login/login.spec.ts`

## Phase 4: User Story 2 - Quien no está autorizado no entra (P1)

**Independent Test**: casos de 401/403 de `api/src/identidad.test.ts`.

- [X] T013 [US2] Tests en `api/src/identidad.test.ts`: sin cabecera, token inválido (401); email sin verificar, fuera de lista, `baja`, `suprimido`, `sub` distinto del vinculado, email duplicado, rol desconocido (403 con cuerpo idéntico); falta `GOOGLE_CLIENT_ID` o la tabla falla (503); el registrador nunca recibe el email, el `sub` ni el token
- [X] T014 [US2] Test en `api/src/functions.test.ts` que recorre `api/src/functions/*.ts` y comprueba que toda Function que no sea `health`, `farolas` o `config` llama a `identificar`

## Phase 5: User Story 3 - Límite de peticiones (P2)

- [X] T015 [US3] Test en `api/src/identidad.test.ts`: la petición 61 del mismo uid en un minuto da 429 con `Retry-After` y otro uid sigue entrando

## Phase 6: User Story 4 - Privacidad antes de entrar (P2)

- [X] T016 [P] [US4] Cláusula de capa 1 (texto de `docs/rgpd/propuesta-rgpd-v1.md` sec. 5.1, marcado como pendiente de validar) antes del botón en `web/src/app/login/login.html` y página `web/src/app/privacidad/privacidad.ts` (capa 2) con bases, plazos, encargados, derechos y contacto
- [X] T017 [US4] CSP de `web/public/staticwebapp.config.json` con lo mínimo de GIS (research.md sec. 8)
- [X] T018 [US4] e2e en `e2e/tests/login.spec.ts`: `/login` muestra la cláusula antes del botón y enlaza a `/privacidad`; `/privacidad` y `/` no piden nada a `accounts.google.com`; `GET /api/yo` sin token da 401 y `GET /api/config` responde

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T019 Registrar en `docs/decisions/registro.md` la decisión de Rafa sobre la lista cerrada y la cabecera `X-Id-Token`, y actualizar `docs/producto.md` y `README.md`/`infra/README.md` con el cliente OAuth de Google
- [X] T020 Ejecutar la skill `revisar-seguridad` sobre el diff y corregir lo que salga
- [X] T021 Build y tests en verde en `api/` y `web/` (cobertura ≥ 80 %), y e2e

## Dependencies & Execution Order

- Setup (T001–T002) → Foundational (T003–T005) → US1 (T006–T012) → US2–US4 (añaden casos sobre `identificar()` y la web) → Polish.
- US2 y US3 dependen de T006; US4 depende de T012.

## Parallel Example: User Story 1

```text
T007 yo.ts · T008 config.ts · T011 sesion.ts  (ficheros distintos, tras T006)
```

## Implementation Strategy

MVP = US1 + US2 (sin ellos no hay lista cerrada). US3 y US4 completan el cambio en el mismo PR.

## Phase 8: Convergence

- [X] T022 Volver a `/login` cuando una llamada con token responde 401 (token caducado) en `web/src/app/sesion.ts`, con test en `web/src/app/sesion.spec.ts`, per spec Edge Cases (partial)
