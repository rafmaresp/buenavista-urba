# Data Model: Cambiar el estado de una incidencia

Sin tablas ni campos nuevos. Se reutilizan las entidades de `specs/006-reportar-incidencia-farola/data-model.md`.

## Incidencias (PartitionKey = farola)

| Fila | RowKey | Cambia en este feature |
|---|---|---|
| Incidencia | uuid | `estado` (Merge con ETag). `tipo`, `autor`, `creada`, `comentario` no se tocan. |
| Candado | `abierta` | Se **borra** al pasar a `Completado`; se recrea solo al deshacer. |

## Estados y transiciones

```text
Nuevo → Recibido → Profesional notificado → Completado
  └──────────┴──────────────┴─────────────────┘  (se puede saltar hacia delante)
```

- Válidos: `Nuevo`, `Recibido`, `Profesional notificado`, `Completado`.
- Transición válida: índice destino > índice actual.
- `Completado` es final y deja la farola sin candado (vuelve a admitir avisos).
- Solo es modificable la incidencia a la que apunta el candado de su farola (la abierta).

## Auditoria

| Campo | Valor |
|---|---|
| actor | uid de la directiva |
| accion | `incidencia.estado` |
| entidad | `Incidencias` |
| clave | `<farola>/<id>` |
| antes | `{"estado":"Nuevo"}` |
| despues | `{"estado":"Recibido"}` |

Nunca autor ni comentario.

## Permisos

SAS de `Incidencias` de la app: `raud` (antes `rad`).
