# Constitución de Buenavista I · Incidencias

Principios que toda spec, plan e implementación de este repo MUST cumplir. El contexto de producto (roles, reglas de negocio, alcance de la v1) está en `docs/producto.md`; las decisiones de Rafa, en `docs/decisions/registro.md`.

## Principios

### I. Coste 0–1 €/mes
Ningún recurso de Azure ni servicio externo de pago se añade sin aprobación expresa de Rafa, aunque cueste céntimos. Se usan niveles gratuitos o de pago por uso con coste despreciable (SWA Free, Table Storage) y ningún recurso se crea sin el presupuesto de 1 €/mes con corte automático.

### II. Privacidad por diseño (RGPD)
Datos personales mínimos. Nada de emails, `sub`, tokens ni cuerpos de petición en logs, auditoría, fixtures o commits. La auditoría guarda un `uid` aleatorio, nunca el email. Sin cookies de rastreo ni analítica. Recursos en región UE. Referencia: `docs/rgpd/propuesta-rgpd-v1.md`.

### III. Toda escritura se audita
Cada operación que escribe datos genera en la misma operación una entrada de auditoría (quién, qué, cuándo, antes, después), append-only. Si no se puede auditar, no se escribe. Cada feature que escribe incluye tests de la entrada generada.

### IV. Autorización en el servidor
El rol (comunero o directiva) y la pertenencia a la lista cerrada se comprueban en cada Function a partir del ID token de Google validado. El front solo muestra u oculta controles.

### V. Tests en la CI, sin atajos
Toda feature trae tests (unitarios con Vitest; integración contra Azurite desde el catálogo de farolas; e2e con Playwright desde el mapa). Build y tests en verde en `web/` y `api/` antes de dar un cambio por terminado. Nunca se desactiva, salta ni debilita un test para pasar a verde.

### VI. Simplicidad y cambios pequeños
Primero la solución más simple. Una feature = un issue = un PR de tamaño S o M (ver `docs/roadmap.md`); si sale L se parte antes de implementar. Se reutiliza antes de crear.

## Stack y restricciones

Angular + Leaflet (PNOA por defecto y OSM, autohospedados) en `web/`; Azure Functions v4 en Node 22 y TypeScript estricto en `api/`; Azure Static Web Apps (plan Free) con API gestionada; Azure Table Storage con `@azure/data-tables`; login con Google Identity Services y `google-auth-library` (sin auth de SWA); infraestructura con Bicep desplegada con OIDC. Fuera: .NET, Google Maps, WhatsApp, previews de SWA por PR.

## Flujo de trabajo

- Se desarrolla desde issues de GitHub con Claude Code Action (ver `AGENTS.md`).
- Feature nueva: spec, plan y tareas en `specs/NNN-nombre/` → revisión de Rafa en el PR → implementación en el mismo PR.
- Sin auto-merge: Rafa revisa y fusiona todos los PRs. Nadie hace push a `main`.
- Idioma: español de España en specs, docs, issues, PRs y commits.

## Gobierno

Esta constitución prevalece sobre cualquier otra práctica. Cambiarla requiere aprobación de Rafa en un PR que actualice también `docs/decisions/registro.md`. Cada plan comprueba su cumplimiento en la sección "Constitution Check"; una desviación se justifica en "Complexity Tracking".

**Version**: 1.0.1 | **Ratified**: 2026-11-13 | **Last Amended**: 2026-11-14
