# Diseño — pagina-acerca-de

## Contexto

Stack cerrado (`docs/producto.md`): Angular en `web/`, Azure Functions Node 22/TS en `api/`, Table Storage con `@azure/data-tables`. Constitución: autorización en el servidor, toda escritura auditada, coste 0–1 €/mes, cambios pequeños.

## Decisiones

### D1. Dónde vive el texto
| Opción | Trade-off |
|---|---|
| **Fila única en la tabla `Contenido`** (elegida) | Editable desde la app como pide el issue; una tabla y una fila; auditada con el mecanismo común. Exige añadir la tabla en Bicep y desplegar infra antes que la app. |
| Fichero en el repo | Cero infraestructura, pero la directiva no puede editarlo desde la app: incumple el issue. |
| Reutilizar una tabla existente (`Usuarios`, `Farolas`) | Mezcla entidades distintas; descartado. |

### D2. Lectura anónima y cacheable
`GET /api/acerca` con `Cache-Control` corto (p. ej. 5 min) en la CDN de la SWA, igual que `GET /api/farolas`. Tras editar, la directiva ve su cambio de inmediato porque el front usa la respuesta del `PUT`; el resto lo ve al caducar la caché.

### D3. Escritura
`PUT /api/acerca` (cuerpo `{texto}`): valida token de Google y `email_verified`, busca el rol en `Usuarios` (servidor), exige `directiva`, valida longitud y no vacío, escribe y audita en la misma operación (si no se puede auditar, no se escribe). Auditoría: antes/después `{longitud}`, nunca el texto, ni email ni `sub`. Reutiliza el middleware de autenticación y de límite de peticiones del cambio 4 y `auditar()` del cambio 2 (no se crean nuevos).

### D4. Presentación
Texto plano mostrado con interpolación de Angular (escapado) y `white-space: pre-line`. Sin `innerHTML`, sin Markdown: evita XSS y dependencias. Texto por defecto en el repo (`api/` y copia mínima en `web/` para el caso sin conexión).

### D5. Front
Ruta `/acerca-de` pública, enlace en el menú. Botón "Editar" visible solo si `GET /api/yo` dice directiva (el servidor decide igualmente). Editor: `textarea` con contador y aviso "no escribas datos personales".

## Pruebas (Vitest, integración con Azurite)

- API: GET sin token devuelve texto por defecto y luego el guardado; PUT sin token 401, comunero 403, directiva 200; texto vacío o largo 400; la auditoría tiene entrada sin el texto ni campos prohibidos; la lista de tablas coincide con `infra/`.
- Web: la página muestra el texto, el botón de editar solo para directiva, error de carga con texto por defecto y aviso.

## Seguridad y privacidad (`revisar-seguridad`, a repasar al implementar)

Autorización en servidor; texto escapado; límite de tamaño; sin datos personales ni `editor` expuesto; sin logs del texto; CORS/caché solo en el GET.
