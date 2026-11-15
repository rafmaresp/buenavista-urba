# Feature Specification: Alta de usuarios en la lista cerrada

**Feature Branch**: `claude/project-thread-zce1m8`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Cambio 4c (parte 1), número 006 [pasa a 007: 006 ya existe], nombre corto alta-usuarios. Rafa pide (15-nov-2026) \"dame de alta como admin\". Alta de usuarios en la lista cerrada (tabla Usuarios) desde el despliegue de infraestructura: un secreto del entorno infra, USUARIOS_ALTA, con una línea \"email,rol\" por usuario; el despliegue da de alta solo los que faltan (por email normalizado), con uid UUID v4 aleatorio, sub vacío, estado activo y fecha de alta; cada alta auditada por el repositorio como usuario.alta con actor sistema:carga y sin email; si la auditoría falla se deshace. Nunca modifica usuarios existentes. Los logs solo muestran recuentos, nunca correos. Fuera: baja, supresión, cambio de rol, registro de actividades y nota EIPD (cambio 4d)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rafa queda dado de alta como directiva y puede entrar (Priority: P1)

Rafa guarda en un secreto del entorno de infraestructura una línea con su correo y el rol `directiva`. Al desplegar la infraestructura, el sistema lo da de alta en la lista cerrada y, cuando entra con Google, la web le muestra el rol directiva.

**Why this priority**: Sin ningún usuario en la lista nadie puede entrar, y los cambios que necesitan sesión (reportar incidencias) no se pueden probar en el entorno real.

**Independent Test**: Con una lista de altas que contiene un correo con rol `directiva` y la tabla vacía, ejecutar la carga y comprobar que hay un usuario activo con ese correo normalizado, rol directiva y sin identificador de Google, y una entrada de auditoría sin correo.

**Acceptance Scenarios**:

1. **Given** la lista de altas con `Correo@Gmail.com ,directiva` y la tabla sin ese correo, **When** se despliega la infraestructura, **Then** queda un usuario con el correo normalizado (`correo@gmail.com`), rol `directiva`, estado `activo`, identificador de Google vacío, uid aleatorio y fecha de alta; y la auditoría registra `usuario.alta` con actor `sistema:carga`, clave el uid y solo `{rol, estado}`.
2. **Given** ese usuario dado de alta, **When** entra con su cuenta de Google, **Then** la web le muestra el rol directiva (el login del cambio 4 vincula su identificador).

---

### User Story 2 - Relanzar el despliegue no duplica ni cambia a nadie (Priority: P1)

El despliegue de infraestructura se relanza a menudo. Cada vez solo da de alta los correos que aún no están en la lista; los que ya están no se tocan aunque la línea pida otro rol.

**Why this priority**: Un correo duplicado deja a esa persona sin acceso (el login responde 403 ante duplicados), y cambiar un rol sin pasar por la baja y el cambio de rol auditados saltaría las reglas de `docs/producto.md`.

**Independent Test**: Ejecutar la carga dos veces con la misma lista y comprobar que la segunda da 0 altas y no genera auditoría; cambiar el rol en la lista y comprobar que el usuario existente conserva el suyo.

**Acceptance Scenarios**:

1. **Given** todos los correos de la lista ya dados de alta, **When** se relanza, **Then** informa "0 altas, N existentes" y no escribe nada.
2. **Given** un usuario existente (en cualquier estado) con rol `comunero`, **When** la lista lo trae como `directiva`, **Then** no cambia y cuenta como existente.
3. **Given** el secreto sin definir o vacío, **When** se despliega, **Then** la carga de usuarios no hace nada, avisa y el despliegue sigue en verde.

---

### User Story 3 - Ningún correo sale del secreto (Priority: P1)

El repositorio es público. Los correos solo viven en el secreto y en la tabla; ni el repositorio, ni los registros del despliegue, ni el resumen, ni la auditoría los muestran.

**Why this priority**: RGPD y exposición pública del repositorio y de los registros de Actions.

**Independent Test**: Ejecutar la carga con líneas válidas e inválidas y comprobar que la salida y la auditoría no contienen ningún correo.

**Acceptance Scenarios**:

1. **Given** una carga correcta, **When** termina, **Then** la salida solo contiene recuentos.
2. **Given** una línea mal formada (sin coma, correo sin `@`, rol desconocido, correo repetido en la lista), **When** se carga, **Then** falla antes de escribir nada e indica solo el número de línea y el motivo, sin el contenido.

### Edge Cases

- Líneas en blanco y espacios alrededor: se ignoran y se recortan.
- El mismo correo dos veces en la lista (también con distinta mayúscula): error de validación, no se escribe nada.
- La auditoría falla tras guardar un alta: el alta se deshace y la carga falla; si deshacer también falla, la carga falla avisando de que hay un alta sin auditar (sin correo).
- Dos despliegues a la vez: el despliegue de infraestructura ya se ejecuta de uno en uno.
- La tabla ya tiene dos filas con el mismo correo (de antes): cuenta como existente y no crea otra.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La lista de altas MUST llegar solo por un secreto del entorno de infraestructura, una línea `correo,rol` por usuario; el repositorio MUST NOT contener correos de usuarios.
- **FR-002**: La carga MUST validar toda la lista antes de escribir: correo con forma de correo, rol `comunero` o `directiva`, sin correos repetidos tras normalizar (minúsculas, sin espacios).
- **FR-003**: La carga MUST dar de alta solo los correos normalizados que no existan en la lista cerrada, con uid aleatorio, identificador de Google vacío, estado `activo` y fecha de alta.
- **FR-004**: La carga MUST NOT modificar ni borrar usuarios existentes.
- **FR-005**: Cada alta MUST auditarse como efecto de la propia escritura: acción `usuario.alta`, actor `sistema:carga`, clave el uid, antes vacío y después solo `{rol, estado}`; si la auditoría falla, el alta se deshace.
- **FR-006**: Registros, errores y resumen del despliegue MUST mostrar solo recuentos, números de línea y motivos, nunca correos.
- **FR-007**: Sin lista (secreto vacío o ausente), la carga MUST terminar sin escribir y sin fallar.
- **FR-008**: La carga MUST ejecutarse en cada despliegue de infraestructura, también al lanzarlo a mano, y relanzarla MUST NOT tener efectos si la lista no cambia.
- **FR-009**: La aplicación MUST seguir sin permiso para crear ni borrar usuarios; solo el despliegue de infraestructura puede.

### Key Entities

- **Línea de alta**: correo y rol; existe solo en el secreto y en memoria durante la carga.
- **Usuario (lista cerrada)**: la del cambio 4 (uid, correo normalizado, identificador de Google, rol, estado, fechas de alta y baja); esta feature solo crea filas.
- **Entrada de auditoría**: la existente; nueva acción `usuario.alta`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras fusionar y aprobar el despliegue, Rafa entra en la web y ve el rol directiva en menos de 10 minutos.
- **SC-002**: Relanzar el despliegue con la misma lista da 0 altas y 0 entradas de auditoría nuevas.
- **SC-003**: Ninguna salida, error ni entrada de auditoría generada en las pruebas contiene un correo.
- **SC-004**: El 100 % de las altas tiene su entrada de auditoría o no existe.

## Assumptions

- Quien escribe el secreto es Rafa (admin del repositorio); añadir un usuario es editar el secreto y lanzar a mano el despliegue de infraestructura.
- Las altas reales de vecinos esperan a que la web esté en la UE; mientras la SWA siga en `eastus2`, solo se dan de alta cuentas de prueba de los devs (Rafa).
- El uid aleatorio cumple la regla de `docs/producto.md`; el rol `directiva` de Rafa es decisión suya como responsable del proyecto.
- Baja, supresión, cambio de rol, registro de actividades y nota de umbral de EIPD van en el cambio 4d.
- El cliente OAuth de Google en modo Testing exige además añadir la cuenta como usuario de prueba en la consola de Google; eso lo hace Rafa fuera del repositorio.
