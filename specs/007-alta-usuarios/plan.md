# Implementation Plan: Alta de usuarios en la lista cerrada

**Branch**: `claude/project-thread-zce1m8` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-alta-usuarios/spec.md`

## Summary

El despliegue de infraestructura da de alta en `Usuarios` los correos de un secreto del entorno `infra` (`USUARIOS_ALTA`, líneas `correo,rol`) que aún no estén, igual que siembra las farolas: script `cargar-usuarios` en `api/`, `RepositorioUsuarios.crear` audita cada alta (`usuario.alta`, actor `sistema:carga`, sin correo) y la deshace si la auditoría falla. El paso usa un SAS de 1 h `rad` sobre `Usuarios`; la app sigue con `ru`.

## Technical Context

**Language/Version**: TypeScript estricto, Node 22

**Primary Dependencies**: `@azure/data-tables` (ya en `api/`), `node:crypto` (`randomUUID`)

**Storage**: Azure Table Storage, tablas `Usuarios` (existente) y `Auditoria`

**Testing**: Vitest (unitarias con dobles de `pruebas/usuarios-dobles.ts`) e integración contra Azurite con SAS de servicio

**Target Platform**: job `desplegar` de `.github/workflows/infra-desplegar.yml` (ubuntu, entorno `infra`)

**Project Type**: script de siembra dentro de la API existente

**Performance Goals**: no aplica (decenas de usuarios)

**Constraints**: ningún correo en repo, logs, resumen ni auditoría; idempotente; nunca modifica filas existentes

**Scale/Scope**: < 200 usuarios (urbanización)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumple | Cómo |
|---|---|---|
| I. Coste | Sí | Sin recursos nuevos; unas pocas transacciones por despliegue |
| II. Privacidad | Sí | Correos solo en el secreto (enmascarado por GitHub) y en la tabla; salida con recuentos y números de línea; auditoría con uid |
| III. Auditoría | Sí | `RepositorioUsuarios.crear` escribe, audita y deshace; tests de la entrada y del deshacer |
| IV. Autorización en servidor | Sí | La app no gana permisos (sigue `ru`); el alta solo la hace el job con la identidad de infra y aprobación de Rafa |
| V. Tests | Sí | Unitarias de validación, carga y repo; integración con Azurite |
| VI. Simplicidad | Sí | Reutiliza el patrón de `cargar-farolas` (script, SAS de 1 h, `sistema:carga`); tamaño S |

Zona sensible (datos personales y workflows): la fusiona Rafa.

## Project Structure

### Documentation (this feature)

```text
specs/007-alta-usuarios/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── usuarios-alta.md
└── tasks.md
```

### Source Code (repository root)

```text
api/src/
├── usuarios.ts                  # + parsearAltas (validación de líneas)
├── usuarios-repo.ts             # + emails(), crear(), AltaUsuarioSinAuditar
├── carga-usuarios.ts            # nuevo: cargarUsuarios(repo, altas)
├── scripts/cargar-usuarios.ts   # nuevo: lee USUARIOS_ALTA, imprime recuentos
├── pruebas/usuarios-dobles.ts   # + createEntity/deleteEntity en el doble
├── usuarios.test.ts, usuarios-repo.test.ts, carga-usuarios.test.ts
└── carga-usuarios.integration.test.ts
.github/workflows/
├── infra-desplegar.yml          # + secreto USUARIOS_ALTA, SAS Usuarios rad, paso "Cargar usuarios"
└── azure-swa.yml                # pasa USUARIOS_ALTA a la llamada
infra/README.md, docs/roadmap.md, docs/decisions/registro.md
```

**Structure Decision**: todo en `api/` junto a la carga de farolas; sin cambios en `web/` ni en Bicep.
