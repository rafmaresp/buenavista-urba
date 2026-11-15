# Feature Specification: Reportar y ver incidencias de farolas

**Feature Branch**: `claude/project-thread-j8d714`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "reportar-incidencia-farola: Un comunero o la directiva (usuarios con sesión en la lista cerrada) puede avisar de que una farola del catálogo está fundida, con un comentario opcional (texto plano, máximo 280 caracteres, con aviso de no escribir datos de terceros). La incidencia nace en estado Nuevo, con autor (uid) y fecha. Una farola con una incidencia abierta (cualquier estado salvo Completado) no admite otra: el servidor lo garantiza con escritura condicional y devuelve la incidencia existente. Cualquiera, también sin sesión, ve en el mapa qué farolas tienen una incidencia abierta y, en la ficha de la farola, su estado y fecha; nunca el autor ni el comentario. Sin sesión, la ficha invita a entrar para avisar. API: POST /api/incidencias (requiere identidad) y GET /api/incidencias (anónimo, solo abiertas). Toda escritura se audita como efecto del repositorio (comentario como {presente, longitud}); si la auditoría falla se deshace. Tabla nueva Incidencias en Bicep con SAS propio. Fuera de alcance: cambiar el estado (solo directiva, otro cambio), voto +1 \"a mí también\", ver el comentario (directiva y autor, en el cambio de gestión de estados), baches, avisos por correo, reubicar farolas, usuarios de prueba del e2e con sesión."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un comunero avisa de una farola fundida (Priority: P1)

Un vecino con sesión abierta (comunero o directiva) toca una farola en el mapa, ve en su ficha el botón "Avisar: farola fundida" y un campo de comentario opcional con el aviso de no escribir datos de otras personas, y envía el aviso. La ficha pasa a mostrar la incidencia abierta y la marca de la farola cambia de aspecto.

**Why this priority**: Es el propósito de la web: que reportar cueste un toque.

**Independent Test**: Con un usuario de la lista y una farola sin incidencia abierta, enviar el aviso crea una incidencia en estado Nuevo con autor y fecha, y una entrada de auditoría sin el texto del comentario.

**Acceptance Scenarios**:

1. **Given** un usuario activo con sesión y una farola del catálogo sin incidencia abierta, **When** envía el aviso sin comentario, **Then** se crea una incidencia en estado Nuevo con su uid como autor y la fecha actual, y la respuesta devuelve la incidencia (sin autor ni comentario).
2. **Given** lo mismo, **When** envía el aviso con un comentario de hasta 280 caracteres, **Then** el comentario se guarda tal cual (sin espacios al principio ni al final) y la auditoría registra solo que hay comentario y su longitud.
3. **Given** que la auditoría falla, **When** se envía el aviso, **Then** la incidencia no queda guardada y la farola sigue admitiendo un aviso.
4. **Given** una persona sin sesión, **When** abre la ficha de una farola sin incidencia, **Then** ve un enlace para entrar y avisar, no el botón de aviso.

---

### User Story 2 - No se duplican avisos (Priority: P1)

Si una farola ya tiene una incidencia abierta, nadie puede crear otra: la ficha muestra la existente y la API la rechaza aunque dos vecinos avisen a la vez.

**Why this priority**: "Que no haya avisos duplicados" es una prioridad del producto y evita trabajo a la directiva.

**Independent Test**: Lanzar dos avisos simultáneos sobre la misma farola: uno crea la incidencia y el otro recibe "ya hay una incidencia abierta" con la existente.

**Acceptance Scenarios**:

1. **Given** una farola con una incidencia abierta, **When** un usuario envía otro aviso sobre ella, **Then** la API responde que ya existe una incidencia abierta y devuelve la existente, sin crear nada ni auditar.
2. **Given** dos avisos simultáneos sobre la misma farola sin incidencia, **When** llegan a la vez, **Then** exactamente uno crea la incidencia.
3. **Given** una farola con una incidencia abierta, **When** un usuario con sesión abre su ficha, **Then** ve la incidencia y no el botón de aviso.

---

### User Story 3 - Cualquiera ve las incidencias abiertas en el mapa (Priority: P2)

Al abrir el mapa, con o sin sesión, las farolas con una incidencia abierta se distinguen a simple vista y su ficha muestra el estado y la fecha del aviso.

**Why this priority**: Es lo que evita el aviso repetido y da transparencia a los vecinos; depende de que existan incidencias (US1).

**Independent Test**: Con incidencias abiertas guardadas, abrir el mapa sin sesión y comprobar que esas farolas tienen otra marca y que la ficha muestra estado y fecha, sin autor ni comentario.

**Acceptance Scenarios**:

1. **Given** incidencias abiertas, **When** cualquiera consulta las incidencias, **Then** recibe solo las abiertas, cada una con farola, estado y fecha, y nunca autor ni comentario.
2. **Given** el mapa abierto, **When** carga, **Then** las farolas con incidencia abierta muestran una marca distinta y su ficha dice "Incidencia abierta: Nuevo, avisada el dd/mm/aaaa".
3. **Given** que falla la carga de incidencias, **When** se abre el mapa, **Then** las farolas se ven igualmente y aparece un aviso de que no se pudieron cargar las incidencias.

### Edge Cases

- Farola que no existe en el catálogo o identificador mal formado: se rechaza como petición no válida, sin escribir ni auditar.
- Comentario de más de 280 caracteres, o que no es texto: se rechaza como petición no válida. Un comentario solo con espacios cuenta como "sin comentario".
- Cuerpo de la petición que no es JSON o con campos de más: se rechaza como no válido (los campos de más se ignoran).
- Usuario fuera de la lista, de baja o sin identidad: 403 o 401 genéricos, como en el resto de la API.
- Usuario que lanza muchos avisos: le frena el límite de peticiones por usuario ya existente.
- Fallo del almacenamiento al crear o leer: error genérico sin detalles internos.
- Sesión caducada al enviar el aviso: la web cierra la sesión y lleva a entrar, como en el resto de la web.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a un usuario activo de la lista cerrada (comunero o directiva) crear una incidencia de "farola fundida" sobre una farola del catálogo.
- **FR-002**: La incidencia MUST guardar: farola, estado `Nuevo`, autor (uid), fecha de creación y comentario opcional (texto plano, recortado, como máximo 280 caracteres).
- **FR-003**: El sistema MUST rechazar sin escribir nada un aviso sobre una farola que no está en el catálogo o con un comentario que no cumple FR-002.
- **FR-004**: Una farola con una incidencia abierta (cualquier estado salvo `Completado`) MUST NOT admitir otra; el servidor lo garantiza aunque lleguen avisos simultáneos, y responde con la incidencia existente.
- **FR-005**: Cada alta de incidencia MUST generar, como efecto de la propia escritura, una entrada de auditoría con el uid como actor y, en lugar del comentario, solo si hay comentario y su longitud. Si la auditoría falla, el alta se deshace y la operación falla.
- **FR-006**: Cualquiera, sin sesión, MUST poder consultar las incidencias abiertas con farola, estado y fecha. La consulta MUST NOT devolver nunca el autor ni el comentario.
- **FR-007**: El mapa MUST distinguir las farolas con una incidencia abierta y su ficha MUST mostrar el estado y la fecha del aviso.
- **FR-008**: La ficha de una farola sin incidencia abierta MUST mostrar, a quien tiene sesión, el botón de aviso y el comentario opcional con el aviso de no escribir datos de terceros y el contador de caracteres; a quien no tiene sesión, un enlace para entrar.
- **FR-009**: Tras un aviso correcto, o si la API responde que ya existe una incidencia, la ficha y la marca MUST actualizarse sin recargar la página.
- **FR-010**: Si la carga de incidencias falla, el mapa de farolas MUST seguir funcionando y mostrar un aviso.
- **FR-011**: Ni el comentario, ni el email, ni el token, ni el cuerpo de la petición MUST aparecer en logs ni en errores.

### Key Entities

- **Incidencia**: aviso de que una farola está fundida. Atributos: identificador, farola, estado (`Nuevo` en este cambio), autor (uid, nunca el email), fecha de creación, comentario opcional. Una farola tiene a lo sumo una abierta a la vez; las completadas se conservan como historial.
- **Farola**: la del catálogo existente (solo se lee para comprobar que existe).
- **Entrada de auditoría**: la existente; acción `incidencia.alta` sin el texto del comentario.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un vecino con sesión avisa de una farola fundida en dos toques (farola y botón) y en menos de 10 segundos.
- **SC-002**: Con avisos simultáneos sobre la misma farola, el 100 % de las veces queda exactamente una incidencia abierta.
- **SC-003**: El 100 % de las incidencias creadas tiene su entrada de auditoría, y ninguna entrada contiene el texto del comentario.
- **SC-004**: Ninguna respuesta pública contiene el autor ni el comentario de una incidencia.
- **SC-005**: Un visitante sin sesión identifica qué farolas tienen un aviso abierto sin abrir ninguna ficha.

## Assumptions

- Login, lista cerrada, rol y límite de peticiones ya existen (spec 005-login-roles); se reutilizan tal cual. Comunero y directiva pueden avisar por igual.
- Solo hay un tipo de incidencia ("farola fundida"); baches y otros tipos llegan en otros cambios.
- El ciclo de estados y quién los cambia es del cambio de gestión de estados; aquí solo se crea en `Nuevo`, y "abierta" significa "cualquier estado salvo `Completado`".
- El comentario no lo ve nadie en la app hasta el cambio de gestión de estados (directiva y autor). Se guarda ya porque se pide al crear.
- Fuera de alcance: votos "a mí también", cambiar el estado, ocultar el comentario, avisos por correo, baches, reubicar farolas y usuarios de prueba con sesión para el e2e (necesitan un diseño revisado por Rai; el e2e cubre la vista sin sesión y la API lo cubre con integración contra el emulador).
- Conservación del comentario y del autor: la del producto (purga a 12 meses en el cambio de retención); no se añade ningún dato personal nuevo más allá del uid del autor y el comentario previstos en `docs/producto.md`.
- Coste: una tabla más en la cuenta de Storage existente, céntimos al mes; sin recursos nuevos.
