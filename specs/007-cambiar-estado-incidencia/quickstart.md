# Quickstart: Cambiar el estado de una incidencia

## Requisitos

- `api/` y `web/` con `npm ci`. Para la integración, Azurite con `TABLES_CONNECTION`, `TABLES_ACCOUNT_NAME` y `TABLES_ACCOUNT_KEY` (como en la CI).

## Validación

1. `cd api && npm run build && npm test`: unitarias de transiciones, repositorio (orden escribir → auditar, deshacer, ETag, candado) y HTTP (401/403/400/404/409/200); integración con el SAS `raud` si hay Azurite.
2. `cd web && npm run build && npm test`: cliente (`cambiarEstado`, códigos) y ficha (selector solo con rol directiva, estados siguientes, completar libera la farola).
3. e2e (CI): `PUT /api/incidencias/{id}` sin token → 401; sin sesión la ficha no muestra selector.

## Manual (entorno provisional, solo pruebas)

1. Entrar con un usuario `directiva` de la tabla `Usuarios`.
2. Abrir una farola con incidencia en Nuevo, elegir "Recibido" y guardar: la ficha muestra Recibido; en `Auditoria` hay `incidencia.estado` con `{estado}` antes y después.
3. Elegir "Completado": la marca vuelve a normal y la ficha ofrece avisar de nuevo.
4. Con un usuario `comunero`, la ficha no muestra selector y un PUT directo devuelve 403.
