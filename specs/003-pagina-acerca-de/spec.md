# Especificación — pagina-acerca-de

**Rama**: `claude/issue-9-20261114-2247` · **Creada**: 2026-11-14 · **Estado**: borrador (fase spec, sin código) · **Issue**: #9

> Issue de prueba del flujo en dos pasos: se escribe la spec y se para. No se va a implementar.

## Resumen

Página pública "Acerca de", accesible desde el menú sin login, que explica para qué sirve la web, quién la mantiene (la directiva) y cómo pedir acceso. La directiva edita el texto desde la app. Es funcionalidad nueva: añade una pantalla, un endpoint y un dato editable con permiso de rol.

## Historias de usuario

### H1 — Leer "Acerca de" (P1)
Un visitante abre la página desde el menú y lee qué es la web, quién la mantiene y cómo pedir acceso.
- **Prueba independiente**: con el texto por defecto sembrado, la página se ve sin iniciar sesión.
- **Escenarios**:
  1. Dado un visitante sin sesión, cuando abre `/acerca-de`, entonces ve el texto vigente.
  2. Dado que la API no responde, entonces ve el texto por defecto incluido en la app y un aviso de que puede no estar actualizado.

### H2 — Editar el texto (P2)
Un miembro de la directiva edita el texto desde la propia página y se guarda.
- **Prueba independiente**: un usuario directiva guarda un cambio y un visitante lo ve al recargar.
- **Escenarios**:
  1. Dada una sesión directiva, cuando guarda un texto válido, entonces se actualiza y se audita.
  2. Dado un comunero o un visitante, cuando intenta guardar, entonces recibe 403 y no cambia nada.
  3. Dado un texto vacío o demasiado largo, entonces se rechaza con un mensaje claro.

## Requisitos funcionales

- **FR-001**: Enlace "Acerca de" en el menú, visible para todos, y ruta pública `/acerca-de`.
- **FR-002**: `GET /api/acerca` anónimo y cacheable en la CDN de la SWA; devuelve el texto y la fecha de última edición, **nunca quién lo editó**.
- **FR-003**: `PUT /api/acerca` solo para el rol directiva, validado **en el servidor** con el token de Google y la tabla `Usuarios`.
- **FR-004**: Texto plano (sin HTML ni Markdown), con límite de longitud [NEEDS CLARIFICATION: ver pregunta 2]. Se muestra escapado, sin interpretar enlaces.
- **FR-005**: Cada escritura genera una entrada de auditoría (`actor` = uid, antes y después con `{longitud}`; el texto completo no se copia a la auditoría).
- **FR-006**: Si no hay texto guardado, la API devuelve un texto por defecto (versionado en el repo).
- **FR-007**: Límite de peticiones por usuario en la escritura (el de la capa de login).
- **FR-008**: Sin cookies ni analítica nuevas; el texto no contiene datos personales (aviso en el editor).

## Entidades

- **Contenido** (tabla nueva `Contenido`, declarada en Bicep): `PartitionKey = "acerca"`, `RowKey = "actual"`, `texto`, `actualizado` (ISO 8601), `editor` (uid, solo uso interno, no se expone). Una sola fila; el historial vive en la auditoría.

## Fuera de alcance

- Varias páginas o un editor genérico de contenidos; Markdown/HTML; imágenes; historial de versiones en la app; traducciones.
- Mostrar nombres o correos de miembros de la directiva.
- El formulario de solicitud de acceso (cambio 4b): esta página solo explica cómo pedirlo.

## Criterios de éxito

- **SC-001**: Un visitante llega a la página en un toque desde el menú, sin login.
- **SC-002**: Un comunero o un visitante nunca puede modificar el texto (test de servidor).
- **SC-003**: Toda edición deja una entrada de auditoría sin el texto.
- **SC-004**: Coste adicional ≈ 0 € (una fila, unas pocas transacciones).

## Dependencias y encaje

- Depende del cambio 4 (`login-roles`: validación de token, rol directiva, `Usuarios`) y del 2 (tabla `Auditoria` y `auditar()`). Sin ellos no se puede implementar la edición. Podría salir antes solo la lectura con texto fijo, pero se descarta por no partir una feature de tamaño S.
- Tamaño estimado: **S–M** (< 500 líneas). Toca zonas sensibles de la política de fusión (`api/` de autorización, `specs/`, tabla en `infra/`): lo fusiona Rafa.
- Coste: ninguno nuevo. Datos personales nuevos: ninguno (el `uid` del editor ya existe).

## Preguntas abiertas

1. [NEEDS CLARIFICATION] **Cómo pedir acceso**: mientras no exista el cambio 4b (y esté pendiente quién aprueba, ver `docs/producto.md` "Pendiente" 1), ¿el texto indica solo "pídelo a la directiva" o incluye un correo de contacto? Propuesta: sin correo; solo la instrucción general.
2. [NEEDS CLARIFICATION] **Límite de longitud**: propuesta 2000 caracteres, texto plano con saltos de línea.
3. [NEEDS CLARIFICATION] **Quién edita**: propuesta, cualquier usuario con rol directiva (no solo el presidente). ¿Vale?
4. [NEEDS CLARIFICATION] **Texto inicial**: ¿lo redacta Rafa o se parte de un texto genérico que Claude propone y la directiva ajusta?
