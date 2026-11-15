# Implementation Plan: Login con Google y roles

**Branch**: `claude/project-thread-zce1m8` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-login-roles/spec.md`

## Summary

Lista cerrada en una tabla nueva `Usuarios` y un único guardián de identidad en la API (`identificar()`), que valida en cada petición el ID token de Google con `google-auth-library`, busca al usuario por `sub` o, la primera vez, por email verificado (y vincula el `sub` mediante `RepositorioUsuarios`, que audita y deshace si la auditoría falla), exige `estado = activo`, aplica un límite de 60 peticiones/minuto por uid y devuelve `{ uid, rol }`. Endpoints nuevos: `GET /api/yo` (rol) y `GET /api/config` (client ID público). En la web, rutas `/login` (cláusula de capa 1 + botón GIS cargado solo ahí) y `/privacidad`, y un servicio de sesión que guarda el token en memoria y lo envía en la cabecera `X-Id-Token`.

## Technical Context

**Language/Version**: TypeScript estricto; Node 22 (API) y Angular 22 (web)

**Primary Dependencies**: `google-auth-library` (nueva, API), `@azure/data-tables`, `@azure/functions` v4; Angular Router (ya incluido en `@angular/router`, nuevo en `package.json`)

**Storage**: Azure Table Storage, tabla nueva `Usuarios` (SAS de servicio `ru`), `Auditoria` existente

**Testing**: Vitest (unitarias en `api/` y `web/`), integración contra Azurite (`*.integration.test.ts`), e2e Playwright (`e2e/tests/login.spec.ts`)

**Target Platform**: Azure Static Web Apps Free con API gestionada

**Project Type**: web (Angular + Functions)

**Performance Goals**: una lectura de `Usuarios` por petición autenticada (filtro por `sub` en una partición pequeña)

**Constraints**: 0 € (OAuth de Google gratuito); sin PII en logs; SWA reescribe la cabecera `Authorization` en las API gestionadas (ver research.md), por eso `X-Id-Token`

**Scale/Scope**: ~200 usuarios, una partición `usuario`

## Constitution Check

| Principio | Cumple | Cómo |
|---|---|---|
| I. Coste 0–1 € | Sí | Cliente OAuth de Google gratuito; una tabla más en la misma cuenta |
| II. Privacidad | Sí | Solo uid, email normalizado, sub, rol, estado, fechas. Logs sin email/sub/token (test). Auditoría `{vinculado}` con actor uid. GIS solo en `/login`. Token en memoria |
| III. Toda escritura se audita | Sí | `RepositorioUsuarios.vincularSub()` audita `usuario.vincular` y deshace si falla; tests de ambos casos |
| IV. Autorización en el servidor | Sí | `identificar()` valida token y lee rol/estado de `Usuarios` en cada petición; único helper |
| V. Tests en la CI | Sí | Unitarias, integración con Azurite (SAS `ru` real), e2e de `/login` y `/privacidad` |
| VI. Simplicidad | Sí | Sin sesión propia ni cookies; límite en memoria; tamaño M |

Re-check tras el diseño: sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/005-login-roles/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
└── tasks.md
```

### Source Code (repository root)

```text
api/src/
├── usuarios.ts                       # entidad Usuario, normalizar email
├── usuarios-repo.ts                  # RepositorioUsuarios (buscar, vincularSub auditado)
├── identidad.ts                      # identificar(): token → usuario activo, 401/403/429/503
├── limite.ts                         # límite de peticiones por uid (memoria)
├── yo.ts / config.ts                 # handlers puros
├── functions/yo.ts, functions/config.ts
├── tablas.ts                         # + 'Usuarios'
└── *.test.ts, usuarios.integration.test.ts
infra/main.bicep                      # tabla Usuarios + SAS ru + GOOGLE_CLIENT_ID
infra/main.bicepparam                 # googleClientId (público)
web/src/app/
├── app.routes.ts, app.config.ts      # provideRouter
├── sesion.ts                         # token en memoria, llamadas con X-Id-Token, rol
├── login/ (componente + cargar GIS)
└── privacidad/ (componente)
e2e/tests/login.spec.ts
```

**Structure Decision**: se sigue la estructura existente (módulos planos en `api/src`, Functions finas en `api/src/functions`). En la web se añade el router con la ruta `''` para lo que hoy hay (el hilo del mapa la ocupa) y `<router-outlet>` en la shell, tocando lo mínimo.

## Complexity Tracking

Sin desviaciones.
