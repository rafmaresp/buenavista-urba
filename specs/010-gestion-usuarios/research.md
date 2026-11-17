# Research: Gestión de usuarios por la directiva

## R1. Quitar = baja, no borrar

- **Decision**: "Quitar" pone `estado = baja` y la fecha en `baja`; "Reactivar" vuelve a `activo` y vacía `baja`.
- **Rationale**: `identificar()` ya rechaza cualquier estado distinto de `activo` en cada petición, así que la baja es inmediata sin tocar la identidad. Conserva el uid (auditoría, autoría de incidencias) y el vínculo con Google para reactivar. La fecha de `baja` la usará la retención (cambio 11: correo borrado a los 30 días).
- **Alternatives considered**: borrar la fila (pierde la correspondencia uid ↔ persona que exige `docs/producto.md`; irreversible); supresión desde la app (es un derecho RGPD con su procedimiento; sigue con los devs).

## R2. Permisos del SAS de Usuarios: `raud`

- **Decision**: la app pasa de `ru` a `raud`.
- **Rationale**: `a` para el alta; `d` solo para deshacer un alta cuya auditoría falle, el mismo patrón que la carga (`rad`) e `Incidencias`. Con `u` la app ya podía cambiar cualquier fila (rol incluido), así que `d` no amplía de forma relevante lo que una credencial filtrada permite.
- **Alternatives considered**: `rau` y deshacer marcando la fila como suprimida (deja basura y rompe "un alta sin auditoría no queda"); auditar antes de escribir (una entrada de auditoría sin cambio real, y la auditoría es append-only).

## R3. Concurrencia

- **Decision**: `cambiar` lee la fila y escribe con su ETag (`Merge` con `If-Match`); un 412 se traduce en 409 `usuario-cambiado`. El cliente no manda ETag: la ventana es la de la propia petición, y la pantalla recarga la lista tras cada cambio.
- **Alternatives considered**: ETag desde el cliente (más contrato y estado en la web para 1–5 personas en la directiva).
- **Alta duplicada**: comprobar y crear no es atómico (Table Storage no tiene índices únicos). Riesgo aceptado (spec, Assumptions). Una fila candado por hash del correo cerraría el hueco a costa de una tabla o partición más.

## R4. Saber cuál es la fila propia

- **Decision**: `GET /api/usuarios` marca `propio: true` en la fila de quien llama. `/api/yo` sigue sin devolver el uid.
- **Rationale**: la web necesita ocultar los controles de la fila propia; el servidor los rechaza igualmente (409 `propio-usuario`).

## R5. Rutas y métodos

- **Decision**: `GET`/`POST /api/usuarios` y `PATCH /api/usuarios/{uid}` con cuerpo `{rol}` o `{estado}` (o ambos). Cuerpos con claves desconocidas → 400.
- **Alternatives considered**: rutas por acción (`/baja`, `/rol`): más Functions para lo mismo.

## R6. Corrección de incidencias y farolas

- Fuera de esta feature (spec). Reubicar ya existe (008); cambiar estado de incidencias es `gestion-estados`. Se propone aparte.
