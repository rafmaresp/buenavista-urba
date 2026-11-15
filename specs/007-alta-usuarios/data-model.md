# Data Model: Alta de usuarios en la lista cerrada

## Línea de alta (solo en memoria)

| Campo | Regla |
|---|---|
| `email` | `normalizarEmail()`; forma `algo@dominio.tld` sin espacios ni comas |
| `rol` | `comunero` o `directiva` |

Líneas en blanco ignoradas; correo repetido tras normalizar ⇒ error de validación.

## Fila nueva en `Usuarios` (tabla del cambio 4, sin cambios de esquema)

| Campo | Valor al dar de alta |
|---|---|
| `partitionKey` | `usuario` |
| `rowKey` | `randomUUID()` |
| `email` | normalizado |
| `sub` | `''` |
| `rol` | de la línea |
| `estado` | `activo` |
| `alta` | fecha ISO de la carga |
| `baja` | `''` |

## Auditoría generada

| Acción | actor | entidad | clave | antes | después |
|---|---|---|---|---|---|
| `usuario.alta` | `sistema:carga` | `Usuarios` | uid | `null` | `{ "rol": …, "estado": "activo" }` |

## Permisos

| Quién | Usuarios | Auditoria |
|---|---|---|
| App (SAS de 1 año) | `ru` (sin cambios) | `ra` |
| Carga en el despliegue (SAS de 1 h) | `rad` | `a` |
