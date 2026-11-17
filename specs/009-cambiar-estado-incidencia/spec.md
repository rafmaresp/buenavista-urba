# Feature Specification: Cambiar el estado de una incidencia (directiva)

**Feature Branch**: `claude/project-thread-fx62nb`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Cambiar el estado de una incidencia de farola (cambio 7 gestion-estados, recortado). La directiva (rol directiva de la tabla Usuarios; Rafa la llama \"admin\"), con sesión, cambia el estado de una incidencia abierta desde la ficha de la farola en el mapa, con un selector. Endpoint PUT /api/incidencias/{id} con cuerpo {farola, estado}; identifica en cada petición con identificar() y exige rol directiva (403 si es comunero). Estados de docs/producto.md: Nuevo → Recibido → Profesional notificado → Completado; solo hacia delante (se pueden saltar estados), no se reabre una Completada; validado en servidor. Al pasar a Completado la farola vuelve a admitir avisos (se borra la fila candado) y la incidencia deja de verse en el mapa. Concurrencia con ETag: dos cambios simultáneos no se pisan (409). Auditoría como efecto del repositorio (incidencia.estado, antes/después solo el estado, sin autor ni comentario); si auditar falla se deshace. El SAS de Incidencias de la app pasa de rad a raud (cambio de infra que Rafa aprueba al fusionar). Fuera de alcance: panel de gestión con filtros y orden, fecha estimada de Profesional notificado, ver u ocultar el comentario, votos, avisos por correo al autor, baches, reubicar farolas (otro hilo en paralelo)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La directiva avanza el estado de una incidencia (Priority: P1)

Un miembro de la directiva con sesión abre en el mapa la ficha de una farola con incidencia abierta, ve el estado actual y un selector con los estados siguientes, elige uno y lo guarda. La ficha muestra el nuevo estado sin recargar la página.

**Why this priority**: Sin esto las incidencias se quedan para siempre en Nuevo y los vecinos no saben si alguien las atiende.

**Independent Test**: Con una incidencia en Nuevo y un usuario de la directiva, pasar a Recibido deja la incidencia en Recibido y una entrada de auditoría con el estado anterior y el nuevo.

**Acceptance Scenarios**:

1. **Given** una incidencia abierta en Nuevo y un usuario de la directiva con sesión, **When** la pasa a Recibido, **Then** la incidencia queda en Recibido, la respuesta devuelve la incidencia actualizada (sin autor ni comentario) y se audita `{estado: Nuevo}` → `{estado: Recibido}` con su uid como actor.
2. **Given** una incidencia en Nuevo, **When** la directiva la pasa directamente a Profesional notificado, **Then** se acepta (se pueden saltar estados).
3. **Given** una incidencia en Profesional notificado, **When** la directiva intenta volver a Recibido o a Nuevo, **Then** se rechaza y la incidencia no cambia.
4. **Given** que la auditoría falla, **When** la directiva cambia el estado, **Then** la incidencia conserva el estado anterior y la operación falla.
5. **Given** la ficha de una farola con incidencia abierta, **When** la abre la directiva, **Then** el selector ofrece solo los estados posteriores al actual; un comunero o un visitante no ven selector.

---

### User Story 2 - Completar libera la farola (Priority: P1)

Cuando la directiva marca una incidencia como Completado, la farola deja de aparecer con incidencia en el mapa y vuelve a admitir avisos.

**Why this priority**: Si una farola arreglada siguiera bloqueada, nadie podría avisar de que ha vuelto a fundirse.

**Independent Test**: Completar la incidencia de una farola y, después, crear un aviso nuevo sobre esa farola: se crea una incidencia nueva en Nuevo.

**Acceptance Scenarios**:

1. **Given** una incidencia abierta, **When** la directiva la pasa a Completado, **Then** desaparece de la lista de incidencias abiertas y la marca de la farola vuelve a su aspecto normal.
2. **Given** una farola cuya incidencia se completó, **When** un comunero avisa de nuevo, **Then** se crea una incidencia nueva en Nuevo.
3. **Given** una incidencia Completado, **When** alguien intenta cambiar su estado, **Then** se rechaza (no se reabre).
4. **Given** que la auditoría falla al completar, **When** se deshace, **Then** la incidencia sigue abierta en su estado anterior y la farola sigue sin admitir otro aviso.

---

### User Story 3 - Solo la directiva cambia estados (Priority: P1)

El servidor decide quién puede cambiar estados a partir de la identidad validada en cada petición; lo que muestre la web no cuenta.

**Why this priority**: Constitución IV: la autorización está en el servidor.

**Independent Test**: La misma petición con un comunero recibe 403 y con la directiva se acepta.

**Acceptance Scenarios**:

1. **Given** una petición sin token o con un token no válido, **When** intenta cambiar un estado, **Then** recibe 401 y nada cambia.
2. **Given** un comunero activo, **When** intenta cambiar un estado, **Then** recibe 403 con el mismo cuerpo genérico que el resto de rechazos y nada cambia ni se audita.
3. **Given** un usuario de la directiva dado de baja, **When** lo intenta, **Then** recibe 403.

---

### Edge Cases

- Dos miembros de la directiva cambian a la vez la misma incidencia: uno gana y el otro recibe "la incidencia ha cambiado" con el estado actual, sin pisar el primero.
- Incidencia inexistente, o que no pertenece a la farola indicada: 404.
- Estado desconocido, igual al actual o anterior al actual: 400 o 409 según el caso (ver contrato), sin escribir.
- La incidencia es una fila suelta que no es la abierta de su farola (alta a medias): no se puede cambiar (404).
- Si deshacer tras un fallo de auditoría también falla, la operación falla con un error propio para revisarlo a mano, como en el alta.
- Token caducado en mitad de la sesión: la web cierra la sesión y lleva al login, como en el aviso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir cambiar el estado de una incidencia abierta solo a usuarios activos con rol directiva, comprobado en cada petición a partir de la identidad validada.
- **FR-002**: Los estados válidos MUST ser, en este orden: Nuevo, Recibido, Profesional notificado, Completado. Solo se admiten cambios a un estado posterior al actual (se pueden saltar estados); una incidencia Completado no cambia más.
- **FR-003**: Al pasar a Completado, la farola MUST volver a admitir avisos y la incidencia MUST dejar de figurar entre las abiertas.
- **FR-004**: Dos cambios simultáneos sobre la misma incidencia MUST NOT pisarse: el segundo se rechaza y recibe el estado actual.
- **FR-005**: Cada cambio MUST auditarse como efecto de la propia escritura, con el uid del actor y solo el estado antes y después (ni autor ni comentario). Si la auditoría falla, el cambio MUST deshacerse y la operación fallar.
- **FR-006**: La respuesta MUST devolver solo los datos públicos de la incidencia (id, farola, estado, fecha de alta), nunca el autor ni el comentario.
- **FR-007**: La ficha de una farola con incidencia abierta MUST mostrar a la directiva un selector con los estados posteriores al actual y un botón para guardar; a comuneros y visitantes, solo el estado.
- **FR-008**: Tras guardar, la ficha y la marca de la farola MUST reflejar el nuevo estado sin recargar; si se completó, la farola vuelve a mostrarse sin incidencia y admite avisos.
- **FR-009**: Los errores MUST mostrarse en la ficha con un mensaje comprensible (sin sesión o sin permiso, la incidencia cambió, servicio no disponible).
- **FR-010**: El sistema MUST NOT registrar en logs el cuerpo de la petición, el token ni datos personales.

### Key Entities

- **Incidencia**: ya existe (spec 006). Este cambio solo modifica su `estado`; el resto de campos no cambia.
- **Candado de la farola**: ya existe (spec 006). Mientras existe, la farola tiene una incidencia abierta; se elimina al completar.
- **Entrada de auditoría**: acción `incidencia.estado`, clave `farola/id`, antes y después `{estado}`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La directiva cambia el estado de una incidencia en dos toques desde la ficha (elegir estado y guardar).
- **SC-002**: El 100 % de los cambios de estado aceptados tienen su entrada de auditoría; ninguno queda sin auditar.
- **SC-003**: El 100 % de los intentos de comuneros, visitantes o usuarios de baja se rechazan sin cambiar nada.
- **SC-004**: Una farola completada admite un aviso nuevo de inmediato, sin intervención manual.

## Assumptions

- Los estados son los de `docs/producto.md` (decisión del 2026-11-12, que sustituyó a Nuevo / En curso / Completado). Rafa lo confirma en el hilo.
- "Solo hacia delante, se pueden saltar estados y no se reabre una Completada" es la propuesta de `docs/producto.md`, marcada "a confirmar"; se aplica y se señala a Rafa en el PR.
- La fecha estimada de Profesional notificado (opcional en producto) queda para el panel de gestión.
- La directiva cambia estados desde la ficha del mapa; el panel con filtros y orden, ver u ocultar el comentario y los avisos por correo al autor quedan para cambios posteriores.
- Depende de login y roles (spec 005) y de reportar incidencias (spec 006), ya fusionados.
- Cambiar el estado necesita que la app pueda actualizar filas de `Incidencias`: es un cambio de infraestructura que Rafa aprueba al fusionar.
