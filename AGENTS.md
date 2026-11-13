# AGENTS.md

Reglas para cualquier agente de IA que trabaje en este repo. El desarrollo se hace **desde issues de GitHub**: Claude Code se ejecuta en GitHub Actions (`.github/workflows/claude.yml`) cuando Rafa etiqueta un issue con `claude` o escribe `@claude` en un comentario. Nadie desarrolla en local con agentes.

## Producto y contexto (leer antes de empezar)

- Producto, roles y reglas de negocio: `openspec/project.md`.
- Secuencia de cambios hasta la v1: `openspec/roadmap.md`.
- Decisiones de Rafa (en orden cronológico; la más reciente manda): `docs/decisions/registro.md`.
- RGPD: `docs/rgpd/propuesta-rgpd-v1.md`.
- Datos de farolas (fuente de verdad): `data/farolas_buenavista.csv`.

Stack decidido: Angular + Leaflet (PNOA/OSM) en `web/`, Azure Functions v4 en Node 22/TypeScript en `api/`, Azure Static Web Apps (plan Free), Cosmos DB con nivel gratuito, login con Google propio (GIS + `google-auth-library`). Nada de .NET, Google Maps, WhatsApp ni servicios de pago sin aprobación de Rafa. Objetivo de coste: 0–1 €/mes.

## Comandos del proyecto

- Web (`web/`, Angular): `npm ci`, `npm run build`, `npm test`, `npm start`.
- API (`api/`, Azure Functions v4, Node 22/TS): `npm ci`, `npm run build`, `npm test`, `npm start` (requiere Azure Functions Core Tools).
- Antes de dar por hecho un cambio: build y test en verde en `web/` y `api/`.

## Cómo trabajar un issue

1. Lee el issue entero y los documentos de arriba que le afecten. Si el issue es ambiguo o contradice `openspec/project.md` o una decisión, **no implementes**: pregunta en un comentario del issue y para.
2. Cambios no triviales (funcionalidad, API, datos, infraestructura) empiezan como cambio OpenSpec en `openspec/changes/<nombre>/` (`proposal.md`, `design.md`, `tasks.md` y deltas en `specs/`). Si el issue pide "propuesta" o "spec", entrega solo eso. Si pide implementar un cambio ya propuesto, sigue su `tasks.md` y marca las tareas hechas.
3. Un issue = una rama = un PR pequeño (ver tamaños en `openspec/roadmap.md`). Si sale grande (L), propón cómo partirlo en el issue antes de seguir.
4. Reutiliza antes de crear: busca helpers o componentes existentes y di cuál reutilizaste.
5. Ejecuta build y tests de lo que toques antes de terminar. Nunca desactives, saltes ni debilites tests para pasar a verde.
6. Al acabar, deja en el comentario del issue: qué has hecho, cómo se prueba, qué queda pendiente y las dudas. El PR lo abre Rafa con el enlace que deja la Action; en su descripción va `Closes #<issue>` y, si el PR toca `web/src` o `api/src` sin tocar docs, una línea `Docs-impact: none - <motivo>`.

## Reglas fijas

- Idioma: español de España en docs, issues, PR y mensajes de commit. Código e identificadores en inglés salvo términos de dominio ya fijados (farola, incidencia, directiva, comunero).
- Commits con Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…).
- Nunca hagas push a `main` ni fusiones PR: Rafa revisa y fusiona todo.
- No toques `.github/workflows/` salvo que el issue lo pida expresamente.
- Privacidad: nada de emails, tokens ni datos personales en logs, auditoría, fixtures o commits. Respeta `docs/rgpd/`.
- Sin secretos en el repo. Las Actions se fijan por SHA con el comentario de versión.
- Una decisión nueva de Rafa se añade al final de `docs/decisions/registro.md` en el mismo PR que la aplica.
