# Contrato: /api/incidencias

## GET /api/incidencias (anónimo)

`200`, `Cache-Control: no-store`

```json
{ "incidencias": [ { "id": "uuid", "farola": "F07", "estado": "Nuevo", "creada": "2026-11-15T19:30:00.000Z" } ] }
```

Solo abiertas (estado distinto de `Completado`), ordenadas por farola. Nunca `autor` ni `comentario`.

Error de almacenamiento: `500 { "error": "no-disponible" }`, `no-store`, sin detalles.

## POST /api/incidencias (cabecera `X-Id-Token`)

Cuerpo:

```json
{ "farola": "F07", "comentario": "Parpadea desde ayer" }
```

`comentario` opcional (string, ≤ 280 tras recortar). Otros campos se ignoran.

| Caso | Respuesta |
|---|---|
| Creada | `201 { "incidencia": { id, farola, estado: "Nuevo", creada } }` |
| Sin token, token inválido | `401 { "error": "no-autenticado" }` (de `identificar()`) |
| Fuera de la lista, de baja | `403 { "error": "sin-acceso" }` |
| Demasiadas peticiones | `429` con `Retry-After` |
| Cuerpo no JSON, farola mal formada o inexistente, comentario no válido | `400 { "error": "peticion-no-valida" }` |
| La farola ya tiene una abierta | `409 { "error": "ya-abierta", "incidencia": { id, farola, estado, creada } }` |
| Fallo de almacenamiento o auditoría | `503 { "error": "no-disponible" }` |

Todas con `Cache-Control: no-store`. Los logs solo llevan nombre y código del error.
