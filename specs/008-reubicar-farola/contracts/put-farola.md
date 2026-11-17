# Contrato: PUT /api/farolas/{id}

Reubica una farola. Solo rol `directiva`.

## Petición

- Cabecera `X-Id-Token`: ID token de Google (spec 005).
- `id`: `F` + 2 cifras.
- Cuerpo JSON: `{ "lat": number, "lon": number }`. Cualquier otro campo se ignora.

## Respuestas (todas con `Cache-Control: no-store`)

| Estado | Cuerpo | Cuándo |
|---|---|---|
| 200 | `{ "farola": { "id", "calle", "lat", "lon" } }` | reubicada (sin precisión) |
| 400 | `{ "error": "peticion-no-valida" }` | id con otro formato, cuerpo no JSON, lat/lon no numéricos o fuera de la urbanización |
| 401 | `{ "error": "no-autenticado" }` | sin token o token no válido |
| 403 | `{ "error": "sin-acceso" }` | fuera de la lista, inactivo o rol distinto de `directiva` |
| 404 | `{ "error": "no-encontrada" }` | la farola no existe |
| 409 | `{ "error": "farola-cambiada" }` | otra escritura cambió la farola desde que se leyó |
| 429 | `{ "error": "demasiadas-peticiones" }` + `Retry-After` | límite de `identificar()` |
| 503 | `{ "error": "no-disponible" }` | Storage o auditoría no disponibles (el cambio se deshace) |

El orden de comprobación es: identidad (401/403/429/503) → rol (403) → id y cuerpo (400) → existencia (404) → escritura (409/503).

## Efectos

- `Farolas`: `lat`, `lon` y `precision = verificada`.
- `Auditoria`: una entrada `farola.reubicacion` (ver [data-model.md](../data-model.md)).
