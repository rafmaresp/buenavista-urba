# Data Model: Aviso de mantenimiento

## Tabla `Avisos` (Azure Table Storage)

| Campo | Tipo | Notas |
|---|---|---|
| `PartitionKey` | string | Constante `aviso` |
| `RowKey` | string | Constante `vigente` (un único aviso) |
| `fechaHora` | string (ISO 8601 UTC) | Momento del mantenimiento; define la caducidad |
| `texto` | string | Texto plano, 1–140 caracteres |
| `creadoEn` | string (ISO 8601 UTC) | Momento de publicación |
| `autorUid` | string | `uid` opaco de la directiva; nunca se expone en la API pública |

## Validación
- `texto`: obligatorio, recortado, 1–140 caracteres, sin interpretar HTML.
- `fechaHora`: obligatoria, ISO 8601 válida y posterior al instante de publicar.

## Estados
- **Vigente**: `fechaHora` > ahora. **Caducado**: `fechaHora` ≤ ahora (no se devuelve). **Quitado**: fila borrada.
- Transiciones: publicar (crea o sustituye), quitar (borra), caducar (automática por tiempo).

## Auditoría
Cada PUT/DELETE escribe en `Auditoria` (actor `uid`, acción `aviso.publicar`/`aviso.quitar`, cuándo, antes y después como `{presente, longitud, fechaHora}`), en la misma operación y sin el texto.
