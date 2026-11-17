# Implementation Plan: Gestión de usuarios por la directiva

**Branch**: `claude/project-thread-arof49` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-gestion-usuarios/spec.md`

## Summary

La directiva gestiona la lista cerrada (`Usuarios`) desde una pantalla `/usuarios`: listar, dar de alta, cambiar rol y dar de baja o reactivar. Tres rutas nuevas en la API (`GET` y `POST /api/usuarios`, `PATCH /api/usuarios/{uid}`), todas tras `identificar()` y con rol `directiva`. Las escrituras pasan por `RepositorioUsuarios`, que ya da de alta auditando (`crear`, spec 007) y ahora también cambia rol y estado con ETag, auditando `usuario.cambio` y restaurando si la auditoría falla. El SAS de la app sobre `Usuarios` pasa de `ru` a `raud`. En la web, componente perezoso `/usuarios` y enlace en la cabecera solo para la directiva.

## Technical Context

**Language/Version**: TypeScript estricto; Node 22 (API), Angular (web)

**Primary Dependencies**: `@azure/functions` v4, `@azure/data-tables`, `google-auth-library` (ya presentes); ninguna nueva

**Storage**: Azure Table Storage, tabla `Usuarios` existente (sin campos nuevos) y `Auditoria`

**Testing**: Vitest (unitarias api/web), integración contra Azurite, e2e Playwright con la API simulada

**Target Platform**: Azure Static Web Apps Free con API gestionada

**Project Type**: aplicación web (`web/` + `api/`)

**Performance Goals**: decenas de usuarios; una consulta de partición por listado

**Constraints**: 0 € adicionales; sin correos en logs, auditoría ni errores; `Cache-Control: no-store`

**Scale/Scope**: < 200 usuarios, 1–5 personas en la directiva

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumple | Cómo |
|---|---|---|
| I. Coste 0–1 € | Sí | Sin recursos nuevos; unas pocas transacciones de Table Storage |
| II. Privacidad | Sí | Solo la directiva recibe correos; nunca el `sub`; auditoría con uid y `{rol, estado}`; los errores solo llevan nombre y código |
| III. Toda escritura se audita | Sí | `RepositorioUsuarios.crear` y `cambiar` auditan como efecto y deshacen (borrar el alta o restaurar rol y estado); tests de entrada y de deshacer |
| IV. Autorización en el servidor | Sí | Cada Function llama a `depsIdentidad`/`identificar` y exige `directiva`; la regla "no a uno mismo" se valida en el servidor |
| V. Tests | Sí | Unitarias de repo, HTTP y web; integración con el SAS `raud`; e2e de la pantalla |
| VI. Simplicidad | Sí | Reutiliza `crear`, `normalizarEmail`, la forma de email de `parsearAltas`, el patrón de `farolas-http.ts` y el de la ficha de reubicar |

Re-check tras el diseño: sin cambios. El paso de `ru` a `raud` amplía permisos de la app; se justifica en research.md (R2).

## Project Structure

### Documentation (this feature)

```text
specs/009-gestion-usuarios/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api-usuarios.md
└── tasks.md
```

### Source Code (repository root)

```text
api/src/
├── usuarios.ts                 # + esEmailValido, validarAlta, validarCambio
├── usuarios-repo.ts            # + listar, leer, cambiar; errores UsuarioNoEncontrado, UsuarioCambiado, CambioUsuarioSinAuditar
├── usuarios-http.ts            # nuevo: respuestaListar, respuestaAlta, respuestaCambiar
├── functions/usuarios.ts       # nuevo: GET/POST /api/usuarios y PATCH /api/usuarios/{uid}
└── pruebas/usuarios-dobles.ts  # + getEntity y updateEntity genérico
infra/main.bicep                # SAS de Usuarios ru → raud
web/src/app/
├── usuarios/usuarios-cliente.ts  # nuevo
├── usuarios/usuarios.ts|html     # nuevo, ruta perezosa /usuarios
├── app.routes.ts, app.html       # ruta y enlace solo directiva
└── privacidad/privacidad.html    # la directiva ve la lista de correos
e2e/tests/usuarios.spec.ts      # nuevo
docs/producto.md, docs/roadmap.md, docs/decisions/registro.md
```

**Structure Decision**: la estructura existente de `api/` (módulo de dominio + repositorio + capa HTTP + Function fina) y `web/` (componente perezoso por ruta con su cliente).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| SAS de la app sobre `Usuarios` con `a` y `d` | Dar de alta desde la app y deshacer un alta si la auditoría falla (constitución III) | Sin `d`, un alta sin auditar quedaría activa; marcarla como suprimida dejaría filas basura y un acceso concedido sin rastro |
