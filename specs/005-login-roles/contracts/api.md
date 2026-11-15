# Contrato de la API: Login con Google y roles

Cabecera de identidad en operaciones no públicas: `X-Id-Token: <ID token de Google>`.

Errores comunes (cuerpo JSON, `Cache-Control: no-store`):

| Estado | Cuerpo | Cuándo |
|---|---|---|
| 401 | `{ "error": "no-autenticado" }` | Sin cabecera, token inválido, caducado, de otro emisor o audiencia |
| 403 | `{ "error": "sin-acceso" }` | Email sin verificar, fuera de la lista, estado ≠ activo, `sub` distinto del vinculado, email duplicado |
| 429 | `{ "error": "demasiadas-peticiones" }` + `Retry-After` | > 60 peticiones/min del mismo uid |
| 503 | `{ "error": "no-disponible" }` | Falta `GOOGLE_CLIENT_ID`, tabla caída |

## GET /api/yo

Autenticado. `200 { "rol": "comunero" | "directiva" }`, `Cache-Control: no-store`.

## GET /api/config

Anónimo. `200 { "googleClientId": "<id>.apps.googleusercontent.com" }` (`""` si no está configurado), `Cache-Control: public, max-age=300`.
