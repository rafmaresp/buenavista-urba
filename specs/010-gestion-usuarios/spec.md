# Feature Specification: Gestión de usuarios por la directiva

**Feature Branch**: `claude/project-thread-arof49`

**Created**: 2026-11-17

**Status**: Draft (opción 2 elegida por Rafa en el chat del proyecto)

**Input**: User description: "Gestión de usuarios desde la app. La directiva, con sesión, gestiona la lista cerrada desde una pantalla /usuarios: ver la lista (correo, rol, estado, si ha entrado alguna vez; nunca el identificador de Google; sin suprimidos), dar de alta un correo de Google con rol comunero o directiva, cambiar el rol, dar de baja (reversible) y reactivar. Quien no esté activo en la lista no puede entrar. Nadie puede cambiarse el rol ni darse de baja a sí mismo. Un correo ya registrado no se da de alta otra vez. Cada escritura se audita sin correo y se deshace si la auditoría falla. Solo directiva. Fuera: supresión RGPD, solicitudes de acceso, corregir incidencias o farolas desde la app."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La directiva da de alta a un vecino (Priority: P1)

Un miembro de la directiva recibe por WhatsApp o en persona el correo de Google de un vecino nuevo. Entra en la app, abre "Usuarios", escribe el correo, elige "comunero" y pulsa "Dar de alta". El vecino ya puede entrar con su cuenta de Google y reportar incidencias.

**Why this priority**: sin esto, cada alta pasa por los devs y un despliegue de infraestructura; es lo que hace que la lista cerrada sea usable por la comunidad.

**Independent Test**: con una sesión de directiva, dar de alta un correo y comprobar que aparece en la lista como activo, que esa cuenta puede entrar y que hay una entrada de auditoría sin correo.

**Acceptance Scenarios**:

1. **Given** una sesión de directiva, **When** abre la pantalla de usuarios, **Then** ve la lista con correo, rol, estado y si cada uno ha entrado ya alguna vez.
2. **Given** la pantalla de usuarios, **When** da de alta un correo válido con un rol, **Then** el usuario aparece activo con ese rol y la app lo confirma.
3. **Given** un correo que ya está en la lista (activo o de baja, sin distinguir mayúsculas ni espacios), **When** intenta darlo de alta, **Then** la app avisa de que ya existe y no crea nada.
4. **Given** un correo mal escrito o un rol desconocido, **When** intenta darlo de alta, **Then** se rechaza sin escribir nada.
5. **Given** un alta hecha, **Then** queda una entrada de auditoría con quién (uid de la directiva), qué (alta), cuándo, y después el rol y el estado; nunca el correo.

---

### User Story 2 - La directiva da de baja y reactiva (Priority: P1)

Un vecino vende la casa. La directiva pulsa "Dar de baja" en su fila: desde la siguiente petición esa cuenta ya no puede hacer nada con sesión. Si fue un error, "Reactivar" lo devuelve a activo con el mismo rol.

**Why this priority**: "quien no esté en la lista no puede entrar" exige poder sacar a alguien, y un error no debe exigir a los devs.

**Independent Test**: dar de baja a un usuario y comprobar que su siguiente petición con sesión recibe "sin acceso"; reactivarlo y comprobar que vuelve a entrar.

**Acceptance Scenarios**:

1. **Given** un usuario activo, **When** la directiva lo da de baja, **Then** su estado pasa a baja y cualquier petición suya con sesión se rechaza desde ese momento.
2. **Given** un usuario de baja, **When** la directiva lo reactiva, **Then** vuelve a activo con el rol que tenía y puede entrar con la misma cuenta.
3. **Given** cualquier baja o reactivación, **Then** queda una entrada de auditoría con el estado anterior y el nuevo, sin correo.

---

### User Story 3 - La directiva cambia el rol (Priority: P2)

Cambia la junta: la directiva saliente pasa a otro vecino a "directiva" y a sí misma la pasa otro miembro a "comunero".

**Why this priority**: sucede una vez al año; se puede vivir unas semanas con los devs, pero es parte natural de gestionar la lista.

**Independent Test**: cambiar el rol de un usuario y comprobar que su siguiente petición tiene el rol nuevo y que hay auditoría con el rol anterior y el nuevo.

**Acceptance Scenarios**:

1. **Given** un usuario comunero, **When** la directiva le pone "directiva", **Then** desde su siguiente petición tiene permisos de directiva.
2. **Given** la fila de la propia directiva que está gestionando, **Then** no puede cambiarse el rol ni darse de baja (la app no ofrece esos controles y el servidor lo rechaza).

---

### Edge Cases

- Un comunero o un visitante intenta ver o cambiar la lista: el servidor responde "sin acceso" y la app no le muestra la entrada a la pantalla.
- Dos miembros de la directiva cambian a la vez el mismo usuario: uno de los dos recibe "ha cambiado, recarga" y no pisa el cambio del otro.
- El usuario cambiado ya no existe o está suprimido: "no encontrado".
- La auditoría falla al escribir: el alta se borra o el cambio se restaura y la operación falla con "no disponible".
- Dar de alta un correo que ya entró antes y fue suprimido por los devs: se trata como un correo nuevo (la fila suprimida no guarda correo).
- Si dos personas dan de alta el mismo correo exactamente a la vez puede quedar duplicado; ese correo no podría entrar hasta que los devs lo arreglen (riesgo aceptado, ver Assumptions).
- La única persona de la directiva no puede quedarse sin directiva porque no puede quitarse el rol a sí misma.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Solo un usuario activo con rol directiva puede listar, dar de alta, cambiar el rol, dar de baja y reactivar usuarios; el rol y la pertenencia se comprueban en el servidor en cada petición.
- **FR-002**: La lista MUST mostrar por usuario: correo, rol, estado (activo o baja) y si ya ha entrado alguna vez. MUST NOT mostrar el identificador de Google ni incluir usuarios suprimidos.
- **FR-003**: El alta MUST pedir un correo y un rol (comunero o directiva), normalizar el correo (espacios y mayúsculas), validar su forma y crear el usuario activo, sin vincular a ninguna cuenta hasta su primer login.
- **FR-004**: El alta MUST rechazar un correo que ya esté en la lista en cualquier estado salvo suprimido.
- **FR-005**: La directiva MUST poder cambiar el rol de un usuario entre comunero y directiva, y su estado entre activo y baja. No puede suprimir ni borrar.
- **FR-006**: Nadie puede cambiar su propio rol ni su propio estado.
- **FR-007**: Un cambio MUST NOT pisar otro cambio concurrente del mismo usuario: si el usuario cambió desde que se leyó, se rechaza como conflicto.
- **FR-008**: Cada alta y cada cambio MUST generar una entrada de auditoría (actor = uid de quien lo hace, clave = uid del afectado, rol y estado antes y después) sin correo ni identificador de Google; si la auditoría falla, el cambio se deshace y la operación falla.
- **FR-009**: Un usuario de baja MUST perder el acceso con sesión desde su siguiente petición; al reactivarlo, entra con la misma cuenta sin volver a vincularla.
- **FR-010**: La app MUST mostrar la entrada a la pantalla de usuarios solo a la directiva, y en la fila propia MUST NOT ofrecer cambiar rol ni dar de baja.
- **FR-011**: Las respuestas de la gestión de usuarios MUST NOT guardarse en ninguna caché; los correos MUST NOT aparecer en logs ni mensajes de error.
- **FR-012**: El alta por el despliegue de infraestructura (lista de altas en secreto) se mantiene para el primer miembro de la directiva y para recuperarse si nadie de la directiva puede entrar.

### Key Entities

- **Usuario** (lista cerrada, ya existe): uid aleatorio, correo normalizado, vínculo con la cuenta de Google (fijado en el primer login), rol (comunero, directiva) y estado (activo, baja, suprimido). Esta feature no añade campos.
- **Entrada de auditoría** (ya existe): acciones nuevas `usuario.cambio`; `usuario.alta` ya existía con actor de sistema y ahora también con el uid de la directiva.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La directiva da de alta a un vecino en menos de 1 minuto desde el móvil, sin intervención de los devs ni despliegues.
- **SC-002**: Un usuario dado de baja no puede hacer ninguna acción con sesión desde la siguiente petición (0 accesos tras la baja).
- **SC-003**: El 100 % de las altas y cambios tienen su entrada de auditoría, y ninguna entrada contiene un correo.
- **SC-004**: Ningún comunero ni visitante puede leer la lista de correos (0 respuestas con datos a quien no sea directiva).

## Assumptions

- Rafa eligió el 2026-11-17 que la directiva gestione la lista desde la app (opción 2), sustituyendo "la mantienen los devs" de `docs/producto.md` y el workflow de bajas y cambios de rol del cambio 4d del roadmap.
- La directiva ve los correos de todos los usuarios de la lista: es necesario para gestionarla y la directiva actúa en nombre de la comunidad (responsable del tratamiento). Se refleja en `/privacidad`; la revisión fina queda con las preguntas RGPD pendientes de Rai.
- "Quitar" es dar de baja (reversible), no borrar: conserva el uid para la auditoría y las incidencias del usuario. La supresión (vaciar correo y vínculo) sigue siendo de los devs, igual que las solicitudes de acceso.
- Dos altas simultáneas del mismo correo pueden duplicarlo (no hay índice único en la tabla); con dos o tres personas en la directiva el riesgo es despreciable y el efecto es que ese correo no entra hasta que los devs borren la fila sobrante.
- La lista cabe en una pantalla (decenas de usuarios): sin paginación ni búsqueda.
- Corregir incidencias o farolas desde la app queda fuera; se propondrá aparte.
