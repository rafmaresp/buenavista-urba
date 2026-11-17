# Data Model: Gestión de usuarios por la directiva

## Usuarios (existente, sin campos nuevos)

| Campo | Tipo | Notas |
|---|---|---|
| PartitionKey | `usuario` | |
| RowKey (uid) | UUID v4 | Única correspondencia con la persona |
| email | string | Normalizado (`trim().toLowerCase()`); vacío si suprimido |
| sub | string | Vacío hasta el primer login; nunca sale de la API |
| rol | `comunero` \| `directiva` | |
| estado | `activo` \| `baja` \| `suprimido` | La directiva solo mueve entre `activo` y `baja` |
| alta | ISO 8601 | Al crear |
| baja | ISO 8601 \| '' | Se fija al dar de baja y se vacía al reactivar |

### Transiciones (directiva)

```text
(nuevo) --alta--> activo <--baja/reactivar--> baja
suprimido: solo devs; invisible e inmodificable desde la app
```

### Reglas

- Alta: correo con forma válida y no presente en otra fila (salvo suprimidas, que no guardan correo).
- Cambio: el usuario existe y no está suprimido; quien cambia no es el afectado; con ETag.

## Auditoria (existente)

| Acción | actor | clave | antes | despues |
|---|---|---|---|---|
| `usuario.alta` | uid de la directiva (o `sistema:carga`) | uid nuevo | `null` | `{rol, estado}` |
| `usuario.cambio` | uid de la directiva | uid afectado | `{rol, estado}` | `{rol, estado}` |

Nunca correo ni `sub` (lo impide además `entidadDeAuditoria`).

## Vista para la directiva (respuesta de la API)

`{ uid, email, rol, estado, vinculado: boolean, propio: boolean }`
