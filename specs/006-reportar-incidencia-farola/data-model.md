# Data Model: Incidencias

## Tabla `Incidencias` (Table Storage)

Una partición por farola (`PartitionKey` = `F01`…`F70`). Dos tipos de fila:

### Incidencia (RowKey = uuid v4)

| Campo | Tipo | Regla |
|---|---|---|
| `PartitionKey` | string | id de farola existente en `Farolas` (`^F\d{2}$`) |
| `RowKey` | string | uuid v4 aleatorio = id de la incidencia |
| `tipo` | string | `farola-fundida` (único en este cambio) |
| `estado` | string | `Nuevo` al crear; los cambios de estado llegan con gestión de estados |
| `autor` | string | uid del usuario (nunca email ni `sub`) |
| `creada` | string | ISO 8601 UTC |
| `comentario` | string | texto plano recortado, 0–280 caracteres; vacío = sin comentario |

### Candado (RowKey = `abierta`)

| Campo | Tipo | Regla |
|---|---|---|
| `incidencia` | string | id de la incidencia abierta de la farola |

Existe si y solo si la farola tiene una incidencia abierta. Se inserta justo después de la incidencia (inserción condicional: 409 si ya existe); lo borrará el cambio de gestión de estados al pasar a `Completado`. Una incidencia sin candado que la refiera no está abierta.

## Estados

`Nuevo` → (gestión de estados) → … → `Completado`. "Abierta" = cualquier estado salvo `Completado`.

## Auditoría

| Acción | Entidad | Clave | antes | despues |
|---|---|---|---|---|
| `incidencia.alta` | `Incidencias` | `<farola>/<id>` | `null` | `{ farola, estado, comentarioPresente, comentarioLongitud }` |

Actor = uid del autor.

## Permisos (SAS de servicio)

`INCIDENCIAS_CONNECTION`: `rad` (leer, añadir, borrar solo para deshacer). Sin `u` hasta gestión de estados.
