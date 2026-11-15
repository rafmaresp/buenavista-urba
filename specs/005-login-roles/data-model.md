# Data Model: Login con Google y roles

## Tabla `Usuarios` (nueva)

| Campo | Tipo | Regla |
|---|---|---|
| `partitionKey` | string | siempre `usuario` |
| `rowKey` | string | `uid`, UUID v4 aleatorio; única correspondencia con la persona |
| `email` | string | normalizado (`trim().toLowerCase()`); vacío si `suprimido` |
| `sub` | string | identificador de Google; vacío hasta el primer login y si `suprimido` |
| `rol` | `comunero` \| `directiva` | otro valor ⇒ 403 |
| `estado` | `activo` \| `baja` \| `suprimido` | solo `activo` entra |
| `alta` | string ISO | fecha de alta |
| `baja` | string ISO | vacía salvo baja |

- Escrituras de la app: solo `vincularSub` (Merge del campo `sub`, con ETag). Altas, bajas y supresiones, en el cambio siguiente.
- SAS de la app: `ru`.

## Auditoría generada

| Acción | actor | entidad | clave | antes | después |
|---|---|---|---|---|---|
| `usuario.vincular` | uid | `Usuarios` | uid | `{ "vinculado": false }` | `{ "vinculado": true }` |

## Resultado de `identificar()`

`{ uid, rol }` o un error HTTP: 401 (sin token / inválido), 403 (genérico), 429 (límite), 503 (config o tabla).
