# Tasks — scaffold-plataforma

Dueños sugeridos: **Mauri** (web), **Emilio** (api, CI, despliegue), **Marisa** (tests), **Cuesta** (revisión).

## 1. Preparación

- [ ] 1.1 Rama `feat/scaffold-plataforma` desde `main` (Emilio)
- [ ] 1.2 `quality.config.json`: `appPaths` → `["web/src/", "api/src/"]` (Emilio)

## 2. `api/`

- [ ] 2.1 Proyecto Functions v4, Node 22, TS estricto, `host.json` sin Application Insights, `local.settings.sample.json`, `package-lock.json` (Emilio)
- [ ] 2.2 `GET /api/health` anónimo → `200 {"estado":"ok"}`, `Cache-Control: no-store` (Emilio)
- [ ] 2.3 Vitest y tests de `health`: 200, cuerpo, cabecera y método no soportado (Marisa)

## 3. `web/`

- [ ] 3.1 Proyecto Angular estable (standalone, signals, zoneless, sin router), `package-lock.json`, página "Buenavista I · Incidencias — en construcción" (Mauri)
- [ ] 3.2 `web/public/staticwebapp.config.json`: `apiRuntime: node:22`, fallback de navegación, CSP `default-src 'self'`, `nosniff`, `Referrer-Policy` (Emilio)
- [ ] 3.3 Test con Vitest: la página se renderiza con su título (Marisa)

## 4. CI y despliegue

- [ ] 4.1 `.github/workflows/ci.yml`: jobs `web` y `api`, Node 22 con caché npm, `npm ci` + build + test, `permissions: contents: read` (Emilio)
- [ ] 4.2 `.github/workflows/azure-swa.yml`: deploy en push a `main`, omitido con aviso sin token (Emilio)
- [ ] 4.3 (Si Rafa lo aprueba) previews por PR con job de cierre (Emilio)
- [ ] 4.4 CI en verde en el PR, incluidos los workflows `pc-*` (Emilio)

## 5. Documentación

- [ ] 5.1 `README.md`: stack real (Functions Node 22/TS, no .NET), cómo arrancar `web` y `api`, cómo crear SWA Free y el secreto (Emilio)
- [ ] 5.2 `AGENTS.md`: comandos de build y test fuera del bloque generado (Emilio)

## 6. Cierre

- [ ] 6.1 Revisión de arquitectura del PR contra la spec (Cuesta)
- [ ] 6.2 Cerrar el PR #1 con comentario enlazando el nuevo; conservar la rama (Rafa)
- [ ] 6.3 Tras fusionar y comprobar `GET /api/health` desplegado, archivar el cambio (Cuesta)
