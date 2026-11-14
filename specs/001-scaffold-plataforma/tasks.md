# Tasks — scaffold-plataforma

Dueños sugeridos: **Mauri** (web), **Emilio** (api, CI, despliegue), **Marisa** (tests), **Cuesta** (revisión).

## 1. Preparación

- [x] 1.1 Rama `feat/scaffold-plataforma` (Emilio). Creada desde `chore/squad-init` y no desde `main`, porque la documentación aún no está fusionada.
- [x] 1.2 `quality.config.json`: `appPaths` → `["web/src/", "api/src/"]` (Emilio)

## 2. `api/`

- [x] 2.1 Proyecto Functions v4, Node 22, TS estricto, `host.json` sin Application Insights, `local.settings.sample.json`, `package-lock.json` (Emilio)
- [x] 2.2 `GET /api/health` anónimo → `200 {"estado":"ok"}`, `Cache-Control: no-store` (Emilio)
- [x] 2.3 Vitest y tests de `health`: respuesta (200, cuerpo, cabecera) y registro (ruta, solo GET, anónimo) (Marisa; recortados por Emilio por el ratio test/código)

## 3. `web/`

- [x] 3.1 Proyecto Angular estable (standalone, signals, zoneless, sin router), `package-lock.json`, página "Buenavista I · Incidencias — en construcción" (Mauri)
- [x] 3.2 `web/public/staticwebapp.config.json`: `apiRuntime: node:22`, fallback de navegación, CSP `default-src 'self'`, `nosniff`, `Referrer-Policy` (Emilio)
- [x] 3.3 Test con Vitest: la página se renderiza con su título (Marisa)

## 4. CI y despliegue

- [x] 4.1 `.github/workflows/ci.yml`: jobs `web` y `api`, Node 22 con caché npm, `npm ci` + build + test, `permissions: contents: read` (Emilio)
- [x] 4.2 `.github/workflows/azure-swa.yml`: deploy en push a `main`, omitido con aviso sin token (Emilio)
- [x] 4.3 Previews por PR: descartadas por Rafa; el deploy no se dispara en `pull_request` (Emilio)
- [ ] 4.4 CI en verde en el PR, incluidos los workflows `pc-*` (Emilio)

## 5. Documentación

- [x] 5.1 `README.md`: stack real (Functions Node 22/TS, no .NET) y cómo arrancar y probar `web` y `api`; la creación de la SWA y de su secreto se remite al cambio 1b `infra-bicep` (Emilio)
- [x] 5.2 `AGENTS.md`: comandos de build y test fuera del bloque generado (Emilio)

## 6. Cierre

- [ ] 6.1 Revisión de arquitectura del PR contra la spec (Cuesta)
- [ ] 6.2 Cerrar el PR #1 con comentario enlazando el nuevo; conservar la rama (Rafa)
- [ ] 6.3 Tras fusionar y comprobar `GET /api/health` desplegado, archivar el cambio (Cuesta)
