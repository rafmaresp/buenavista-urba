# Contrato: PUT /api/incidencias/{id}

Amplía `specs/006-reportar-incidencia-farola/contracts/api.md`. GET y POST no cambian.

Cabecera `X-Id-Token`. `{id}` = id (uuid) de la incidencia.

Cuerpo:

```json
{ "farola": "F07", "estado": "Recibido" }
```

`estado` ∈ `Nuevo`, `Recibido`, `Profesional notificado`, `Completado`. Otros campos se ignoran.

| Caso | Respuesta |
|---|---|
| Cambiado | `200 { "incidencia": { id, farola, estado, creada } }` |
| Sin token, token inválido | `401 { "error": "no-autenticado" }` |
| Fuera de la lista, de baja o **comunero** | `403 { "error": "sin-acceso" }` |
| Demasiadas peticiones | `429` con `Retry-After` |
| id no uuid, cuerpo no JSON, farola mal formada, estado desconocido | `400 { "error": "peticion-no-valida" }` |
| No es la incidencia abierta de esa farola (inexistente, completada o fila suelta) | `404 { "error": "no-encontrada" }` |
| Estado igual o anterior al actual | `409 { "error": "transicion-no-valida", "incidencia": {…} }` |
| Otro cambio simultáneo ganó | `409 { "error": "ha-cambiado", "incidencia": {…actual} }` |
| Fallo de almacenamiento o auditoría | `503 { "error": "no-disponible" }` |

Todas con `Cache-Control: no-store`. Los logs solo llevan nombre y código del error; nunca el cuerpo.
