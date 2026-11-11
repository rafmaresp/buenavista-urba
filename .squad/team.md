# Squad Team

> buenavista-urba

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Cuesta | Lead / Architect | `.squad/agents/cuesta/charter.md` | ✅ Active |
| Mauri | Frontend Developer | `.squad/agents/mauri/charter.md` | ✅ Active |
| Emilio | Backend Developer | `.squad/agents/emilio/charter.md` | ✅ Active |
| Marisa | Test Engineer | `.squad/agents/marisa/charter.md` | ✅ Active |

## Project Context

- **Project:** buenavista-urba
- **Created:** 2026-11-11
- **Qué es:** web de incidencias de la urbanización Buenavista I (Dos Hermanas, Sevilla): farolas fundidas (70 IDs F01–F70) y baches sobre mapa; vecinos reportan y apoyan ("a mí también"); solo el admin cambia estado (Nuevo / En curso / Completado). Aviso por correo (opcional enlace wa.me). Futuro: capa de redes solo admin.
- **Stack (cerrado):** Angular + Leaflet (PNOA + OSM, sin Google Maps) · Azure Functions Node/TS node:22 con @azure/data-tables y google-auth-library (sin .NET) · Table Storage (+ Blob para fotos) · SWA Free · login Google Identity Services validado en Function (sin auth de SWA Standard).
- **Restricciones:** coste 0–1 €/mes, consultar antes de cualquier recurso de pago; RGPD con datos mínimos de vecinos.
- **Proceso:** OpenSpec (proponer → revisión de Rafa → aplicar → archivar); un PR por cambio; sin merge gate ni auto-merge, Rafa revisa y fusiona.
- **Comunicación:** español de España, directo, con trade-offs concretos.
- **Modelos:** Cuesta → Opus; Mauri, Emilio, Marisa → Sonnet; Scribe/Ralph → Haiku (según `config.json` roleModelOverrides).
