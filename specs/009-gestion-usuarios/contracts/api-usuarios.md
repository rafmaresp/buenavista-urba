# Contrato: /api/usuarios

Todas: cabecera `X-Id-Token`; `Cache-Control: no-store`; errores comunes de `identificar()` (401 `no-autenticado`, 403 `sin-acceso`, 429 `demasiadas-peticiones`, 503 `no-disponible`). Un usuario activo sin rol `directiva` → 403 `sin-acceso`.

## GET /api/usuarios

200:

```json
{ "usuarios": [ { "uid": "…", "email": "ana@example.com", "rol": "comunero", "estado": "activo", "vinculado": true, "propio": false } ] }
```

Ordenados por correo. Sin filas suprimidas. Nunca `sub`.

## POST /api/usuarios

Cuerpo: `{ "email": "Ana@Example.com ", "rol": "comunero" }` (solo esas dos claves).

| Status | Cuerpo | Cuándo |
|---|---|---|
| 201 | `{ "usuario": {…vista…} }` | Alta hecha (activo, `vinculado: false`) |
| 400 | `{ "error": "peticion-no-valida" }` | JSON inválido, claves de más, correo sin forma válida, rol desconocido |
| 409 | `{ "error": "ya-existe" }` | El correo normalizado ya está en una fila no suprimida |
| 503 | `{ "error": "no-disponible" }` | Fallo de tabla o de auditoría (el alta se deshace) |

## PATCH /api/usuarios/{uid}

Cuerpo: `{ "rol"?: "comunero"|"directiva", "estado"?: "activo"|"baja" }`, al menos uno y sin otras claves.

| Status | Cuerpo | Cuándo |
|---|---|---|
| 200 | `{ "usuario": {…vista…} }` | Cambio hecho (o nada que cambiar: sin escribir ni auditar) |
| 400 | `{ "error": "peticion-no-valida" }` | uid sin forma de UUID o cuerpo inválido |
| 404 | `{ "error": "no-encontrado" }` | No existe o está suprimido |
| 409 | `{ "error": "propio-usuario" }` | El uid es el de quien llama |
| 409 | `{ "error": "usuario-cambiado" }` | Otra escritura entre la lectura y la escritura (412) |
| 503 | `{ "error": "no-disponible" }` | Fallo de tabla o de auditoría (el cambio se restaura) |
