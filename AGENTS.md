# AGENTS.md

Reglas para cualquier agente de IA que trabaje en este repo. El desarrollo se hace **desde issues de GitHub**: Claude Code se ejecuta en GitHub Actions (`.github/workflows/claude.yml`) cuando Rafa (o Claude en su nombre desde el proyecto) etiqueta un issue con `claude` o escribe `@claude` en un comentario. Nadie desarrolla en local con agentes.

## Producto y contexto (leer antes de empezar)

- Principios no negociables: `.specify/memory/constitution.md`.
- Producto, roles y reglas de negocio: `docs/producto.md`.
- Secuencia de features hasta la v1: `docs/roadmap.md`.
- Decisiones de Rafa (en orden cronológico; la más reciente manda): `docs/decisions/registro.md`.
- RGPD: `docs/rgpd/propuesta-rgpd-v1.md`.
- Datos de farolas (fuente de verdad): `data/farolas_buenavista.csv`.

Stack decidido: Angular + Leaflet (PNOA/OSM) en `web/`, Azure Functions v4 en Node 22/TypeScript en `api/`, Azure Static Web Apps (plan Free), Cosmos DB con nivel gratuito, login con Google propio (GIS + `google-auth-library`). Nada de .NET, Google Maps, WhatsApp ni servicios de pago sin aprobación de Rafa. Objetivo de coste: 0–1 €/mes.

## Comandos del proyecto

- Web (`web/`, Angular): `npm ci`, `npm run build`, `npm test`, `npm start`.
- API (`api/`, Azure Functions v4, Node 22/TS): `npm ci`, `npm run build`, `npm test`, `npm start` (requiere Azure Functions Core Tools).
- Antes de dar por hecho un cambio: build y test en verde en `web/` y `api/`.

## Cómo trabajar un issue

Se usa [Spec Kit](https://github.com/github/spec-kit) (v1.4.0, integración Claude): las skills `speckit-*` están en `.claude/skills/` y sus scripts en `.specify/scripts/bash/`. Cada feature vive en `specs/NNN-nombre/` (`spec.md`, `plan.md`, `tasks.md` y, si hace falta, `research.md`, `data-model.md`, `contracts/`).

Lee el issue entero y los documentos de arriba que le afecten. Si es ambiguo o contradice la constitución, `docs/producto.md` o una decisión, **no sigas**: pregunta en un comentario y para.

### Feature nueva (funcionalidad, API, datos, infraestructura): dos fases en el mismo PR

1. **Fase spec** (issue con la etiqueta `claude`): sigue `speckit-specify` con el texto del issue, luego `speckit-plan` y `speckit-tasks`. Si `speckit-specify` deja marcas `[NEEDS CLARIFICATION]`, no inventes: lístalas como preguntas en el comentario del issue. **No escribas código de la aplicación en esta fase.** Termina con commits solo en `specs/NNN-nombre/`.
2. Rafa abre el PR con el enlace de la Action, revisa spec, plan y tareas, y pide cambios con `@claude` en el PR.
3. **Fase implementación** (Rafa comenta `@claude implementa` en el PR): sigue `speckit-implement` sobre esa feature, marcando las tareas hechas en `tasks.md`, y después `speckit-converge` hasta que diga `Converged`.

En cada ejecución empiezas con un checkout limpio. Antes de usar una skill sobre una feature existente, crea `.specify/feature.json` con `{"feature_directory":"specs/NNN-nombre"}` (está en `.gitignore`; no se sube).

### Feature nueva pedida desde el proyecto de Claude: flujo ligero

Cuando Rafa pide una funcionalidad en el chat del proyecto de Claude (no en un issue):

1. Claude aplica `disenar-cambio`, hace en el chat las preguntas que falten y resume la spec en cuatro a ocho líneas.
2. Rafa responde "ok" o corrige. Esa respuesta sustituye a la revisión de la fase spec en el PR.
3. Claude crea el issue con lo acordado y abre **un único PR** con spec, plan y tareas (`specs/NNN-nombre/`), código y tests, siguiendo las mismas skills `speckit-*`. La spec completa va en el PR para que Rafa la vea antes de fusionar.

El flujo de dos fases por etiqueta `claude` sigue igual para lo que se pida directamente en GitHub.

### Error, mejora pequeña o documentación

Sin spec: corrige directamente con su test. Si al hacerlo cambia una regla de negocio, para y pregunta.

### Siempre

- Skills de criterio (en `.claude/skills/`): `disenar-cambio` antes de especificar, `escribir-tests` al implementar y `revisar-seguridad` antes de terminar cualquier cambio en `api/`, login, datos, `infra/` o workflows. `revisar-pr` la usa el revisor automático.
- Un issue = una rama = un PR de tamaño S o M (ver `docs/roadmap.md`). Si sale L, propón cómo partirlo en el issue antes de seguir.
- Reutiliza antes de crear: busca helpers o componentes existentes y di cuál reutilizaste.
- Ejecuta build y tests de lo que toques antes de terminar. Nunca desactives, saltes ni debilites tests para pasar a verde.
- Al acabar, deja en el comentario: qué has hecho, cómo se prueba, qué queda pendiente y las dudas. El PR lo abre Rafa con el enlace que deja la Action; en su descripción va `Closes #<issue>`.

## Reglas fijas

- Idioma: español de España en docs, issues, PR y mensajes de commit. Código e identificadores en inglés salvo términos de dominio ya fijados (farola, incidencia, directiva, comunero).
- Commits con Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…).
- Nunca hagas push a `main` ni fusiones PR: Rafa revisa y fusiona todo mientras la política de fusión de abajo no esté activa.
- No toques `.github/workflows/` salvo que el issue lo pida expresamente.
- Privacidad: nada de emails, tokens ni datos personales en logs, auditoría, fixtures o commits. Respeta `docs/rgpd/`.
- Sin secretos en el repo. Las Actions se fijan por SHA con el comentario de versión.
- Una decisión nueva de Rafa se añade al final de `docs/decisions/registro.md` en el mismo PR que la aplica.

## Revisión independiente

Cada PR no borrador lo revisa otro Claude en contexto limpio (`.github/workflows/claude-revisor.yml`, modelo Opus, skill `revisar-pr`). Comenta los hallazgos en el PR y su check **Revisor independiente** queda en rojo mientras haya hallazgos bloqueantes o importantes. Para corregirlos, Rafa (o Claude desde el proyecto) comenta `@claude` en el PR; cada push vuelve a lanzar la revisión.

## Política de fusión

> **Estado: NO ACTIVA.** Hasta que Rafa la active con un PR que cambie esta línea, la constitución (`Sin auto-merge`) y el registro de decisiones, Claude no fusiona nada: todos los PRs los fusiona Rafa. Requisitos previos para activarla: revisor independiente funcionando, tests reales en la CI (desde el cambio 2 del roadmap) y unos cuantos PRs revisados por Rafa con estos checks.

Cuando esté activa, Claude puede fusionar un PR **solo si se cumplen las tres condiciones**:

1. **CI en verde**: todos los checks del PR pasan (`pc-quality-gates` y build/tests de `web/` y `api/`).
2. **Revisor sin hallazgos abiertos**: el check **Revisor independiente** está en verde sobre el último commit.
3. **Sin zonas sensibles**: ningún archivo del PR está en las rutas de `.github/CODEOWNERS`, y el PR no cae en ninguno de los casos de la tabla.

| Zona sensible | Por qué |
|---|---|
| Login, roles y permisos (`api/` de autenticación y autorización, `auth` en `web/`) | Un fallo expone datos o da permisos de directiva |
| Modelo de datos, auditoría y datos personales (`docs/rgpd/`, `data/`) | RGPD y migraciones difíciles de deshacer |
| Capa restringida de redes (tuberías y cables) | Información que no debe ser pública |
| Infraestructura, workflows, configuración de SWA y secretos (`infra/`, `.github/`, `staticwebapp.config.json`) | Controlan el despliegue y los propios guardarraíles |
| La propia política y lo que guía a los agentes (`AGENTS.md`, `CLAUDE.md`, `.claude/`, `.specify/`, `docs/decisions/`) | Para que no se pueda relajar sin Rafa |
| Dependencias con salto de versión mayor (cualquier `package.json`) | Roturas difíciles de prever |
| Funcionalidad nueva completa (`specs/`) o diff de más de 300 líneas sin lockfiles | Ahí decide Rafa si es lo que quería |

Entra sin Rafa: textos, estilos, arreglos acotados, tests, documentación fuera de las rutas anteriores y actualizaciones menores o de parche de dependencias. Tras cada fusión, Claude deja una línea en el chat del proyecto con el PR fusionado; deshacerlo es revertir ese PR. Ante la duda sobre si algo es sensible, es sensible.

