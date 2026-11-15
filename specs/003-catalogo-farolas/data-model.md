# Data Model: Catálogo de farolas

## Tabla `Farolas`

| Campo | Tipo | Regla |
|---|---|---|
| `PartitionKey` | string | Siempre `farola` (70 filas: una partición basta). |
| `RowKey` | string | Id `F01`–`F70` (dos dígitos). |
| `calle` | string | No vacía. |
| `lat` | double | 37.30–37.33 (urbanización). |
| `lon` | double | −5.98 a −5.95. |
| `precision` | string | `verificada` (±2–3 m) o `estimada` (±5–8 m). **Interna**: no sale por la API pública. |

Origen: `data/farolas_buenavista.csv` (`farola,calle,lat,lon,posicion`; `farola` es el número sin prefijo, `posicion` se guarda como `precision`). La semilla se lee hasta la primera línea en blanco (después vienen los tramos).

Validación de la semilla (toda antes de escribir): cabecera exacta; 70 filas; ids 1–70 sin huecos ni repetidos; lat/lon numéricos dentro del rango; `posicion` válida; sin comillas.

## Tabla `Auditoria`

| Campo | Tipo | Regla |
|---|---|---|
| `PartitionKey` | string | Mes UTC `AAAA-MM`. |
| `RowKey` | string | `<ISO 8601 UTC con ms>_<UUID v4>`. |
| `cuando` | string | ISO 8601 UTC. |
| `actor` | string | UUID (uid opaco), `sistema:<nombre>` o `dev:<alias>` (`[a-z][a-z0-9-]*`). |
| `accion` | string | `<entidad>.<verbo>` en minúsculas, p. ej. `farola.alta`. |
| `entidad` | string | Nombre de la tabla afectada, p. ej. `Farolas`. |
| `clave` | string | Clave de la entidad afectada, p. ej. `F07`. |
| `antes` | string | JSON del estado anterior, o vacío en un alta. |
| `despues` | string | JSON del estado posterior, o vacío en un borrado. |

Prohibido en `antes`/`despues` (en cualquier nivel, sin distinguir mayúsculas): claves `email`, `correo`, `sub`, `nombre`, `name`, `comentario`; cualquier valor de texto con forma de email. La entrada se rechaza entera.

Inmutable para la app: el SAS de `Auditoria` solo permite añadir y leer.

## Entrada de auditoría de la carga

```json
{ "actor": "sistema:carga", "accion": "farola.alta", "entidad": "Farolas", "clave": "F07",
  "antes": null, "despues": { "calle": "…", "lat": 37.31, "lon": -5.96, "precision": "estimada" } }
```
