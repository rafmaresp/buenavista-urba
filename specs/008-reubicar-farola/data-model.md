# Data Model: Reubicar farola (directiva)

## Farola (tabla `Farolas`, sin cambios de esquema)

| Campo | Tipo | Cambia al reubicar | Regla |
|---|---|---|---|
| PartitionKey | string | No | `farola` |
| RowKey | string | No | id `F` + 2 cifras |
| calle | string | No | — |
| lat | number | Sí | 37,30 ≤ lat ≤ 37,33 (mismos límites que la semilla) |
| lon | number | Sí | −5,98 ≤ lon ≤ −5,95 |
| precision | `verificada` \| `estimada` | Sí → `verificada` | interna; nunca sale por el `GET` público |

Escritura: `updateEntity` en modo `Merge` con el ETag leído (solo `lat`, `lon`, `precision`). Nunca crea filas.

## Entrada de auditoría (tabla `Auditoria`, contrato de la spec 003)

| Campo | Valor |
|---|---|
| actor | uid de quien reubica |
| accion | `farola.reubicacion` |
| entidad | `Farolas` |
| clave | id de la farola |
| antes | `{"lat":…, "lon":…, "precision":"estimada"}` |
| despues | `{"lat":…, "lon":…, "precision":"verificada"}` |

## Errores del repositorio

| Error | Cuándo | HTTP |
|---|---|---|
| `FarolaNoEncontrada` | `getEntity` da 404 | 404 |
| `FarolaCambiada` | `updateEntity` da 412 | 409 |
| `ReubicacionSinAuditar` | falla la auditoría y también la restauración | 503 (y log para revisar a mano) |
| otro | Storage no disponible o auditoría fallida y restaurada | 503 |
