# Feature Specification: Login con Google y roles

**Feature Branch**: `claude/project-thread-zce1m8`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Cambio 4 del roadmap (login-roles). Login con Google y roles, aprobado por Rafa en el chat del proyecto (15-nov-2026). Botón de Google en la pantalla de login, con la cláusula RGPD de capa 1 antes del botón y la página /privacidad. La API valida la identidad de Google en cada petición. Lista cerrada = tabla Usuarios (uid aleatorio, email, sub, rol comunero o directiva, estado). Primer login fija el sub. Fuera de la lista o inactivo: 403 genérico. Sin identidad válida: 401. El rol se decide en el servidor. Límite de peticiones por usuario. GET /api/yo devuelve el rol. Fuera: alta, baja y supresión de usuarios, solicitar acceso, usuarios de prueba para e2e, escrituras de incidencias."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un comunero de la lista entra con su cuenta de Google (Priority: P1)

Un vecino cuyo correo está dado de alta en la lista cerrada abre la pantalla de entrada, lee la información de privacidad que aparece antes del botón, pulsa "Iniciar sesión con Google" y la web le muestra que ha entrado y con qué rol (comunero o directiva).

**Why this priority**: Sin identidad no hay ninguna acción posible (reportar, votar, gestionar). Es la base de los cambios 5 a 8.

**Independent Test**: Con un usuario dado de alta en la tabla y una identidad de Google válida para su correo, la consulta "quién soy" responde con su rol; la primera vez queda vinculado su identificador de Google y se genera una entrada de auditoría sin datos personales.

**Acceptance Scenarios**:

1. **Given** un usuario activo con rol comunero cuyo identificador de Google aún no está vinculado, **When** entra por primera vez con una identidad de Google válida y verificada de ese correo, **Then** la API responde con el rol `comunero`, vincula su identificador de Google y audita la vinculación con su uid como actor, sin email ni identificador de Google en la entrada.
2. **Given** un usuario ya vinculado, **When** vuelve a entrar, **Then** se le identifica por su identificador de Google (aunque su correo cambie de mayúsculas) y no se genera auditoría nueva.
3. **Given** un usuario con rol directiva, **When** entra, **Then** la API responde con el rol `directiva`.
4. **Given** que la auditoría falla al vincular, **When** el usuario entra, **Then** la vinculación se deshace y la petición falla sin dejar el identificador guardado.

---

### User Story 2 - Quien no está autorizado no entra y no deja rastro (Priority: P1)

Una persona con cuenta de Google que no está en la lista, o que está dada de baja o suprimida, intenta entrar y recibe un mensaje genérico de "no tienes acceso". Quien llama sin identidad o con una caducada o falsificada recibe "inicia sesión".

**Why this priority**: Es la garantía de la lista cerrada (RGPD y abuso). Tan crítica como entrar.

**Independent Test**: Llamar a "quién soy" sin identidad, con identidad inválida, con correo sin verificar, con un correo fuera de la lista y con un usuario de baja, y comprobar las respuestas y que los registros no contienen el correo.

**Acceptance Scenarios**:

1. **Given** una petición sin identidad, **When** llega a una operación no pública, **Then** responde 401.
2. **Given** una identidad caducada, firmada por otro emisor, para otra aplicación o mal formada, **When** llega, **Then** responde 401.
3. **Given** una identidad válida con el correo sin verificar, **When** llega, **Then** responde 403 genérico.
4. **Given** una identidad válida de un correo que no está en la lista, **When** llega, **Then** responde 403 con el mismo cuerpo que cualquier otro 403, y ni el correo ni el identificador de Google aparecen en los registros.
5. **Given** un usuario con estado `baja` o `suprimido`, **When** llega con identidad válida, **Then** responde 403 genérico.
6. **Given** una identidad de Google que no coincide con el identificador ya vinculado al usuario de ese correo, **When** llega, **Then** responde 403 genérico y no cambia la vinculación.

---

### User Story 3 - Uso abusivo limitado por usuario (Priority: P2)

Si un mismo usuario lanza demasiadas peticiones en poco tiempo, la API le responde "demasiadas peticiones" hasta que pase la ventana.

**Why this priority**: Acota el coste (Table Storage cobra por transacción) antes de que lleguen las escrituras.

**Independent Test**: Lanzar más peticiones de las permitidas con el mismo usuario y comprobar que la siguiente responde 429 y que otro usuario no se ve afectado.

**Acceptance Scenarios**:

1. **Given** un usuario que ha superado el límite en la ventana actual, **When** hace otra petición, **Then** responde 429 con la cabecera de reintento.
2. **Given** otro usuario distinto, **When** hace una petición en esa ventana, **Then** se atiende con normalidad.

---

### User Story 4 - Información de privacidad antes de entrar (Priority: P2)

Cualquiera que llegue a la pantalla de entrada ve la cláusula informativa (capa 1) antes del botón de Google y un enlace a la política completa en `/privacidad`. El script de Google solo se carga en la pantalla de entrada.

**Why this priority**: Requisito RGPD previo a tratar ningún dato.

**Independent Test**: Abrir `/login` y `/privacidad` en el navegador y comprobar textos, orden y que fuera de `/login` no se pide nada a Google.

**Acceptance Scenarios**:

1. **Given** un visitante, **When** abre `/login`, **Then** ve la cláusula de capa 1 antes del botón de Google y un enlace a `/privacidad`.
2. **Given** un visitante, **When** abre `/privacidad` o la página principal, **Then** el navegador no descarga nada de Google.

### Edge Cases

- Dos usuarios de la lista con el mismo correo normalizado: la entrada falla con 403 genérico y se registra (sin correo) que hay un duplicado para revisarlo.
- La tabla de usuarios no responde: 503 genérico, sin detalles.
- El cliente envía un rol propio en la petición: se ignora; el rol sale siempre de la tabla.
- La configuración de la aplicación de Google falta en el servidor: todas las operaciones no públicas responden 503 y la pantalla de entrada indica que el inicio de sesión no está disponible.
- La identidad de Google caduca mientras el usuario usa la web (dura una hora): la siguiente operación responde 401 y la web le devuelve a la pantalla de entrada.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La pantalla `/login` MUST mostrar la cláusula de capa 1 antes del botón de Google y enlazar a `/privacidad`.
- **FR-002**: El script de Google MUST cargarse solo en `/login`.
- **FR-003**: La web MUST guardar la identidad de Google solo en memoria (no en almacenamiento del navegador) y enviarla en cada operación no pública.
- **FR-004**: Cada operación no pública MUST validar la identidad en esa misma petición: firma de Google, emisor de Google, que es para nuestra aplicación, que no ha caducado y que el correo está verificado.
- **FR-005**: El sistema MUST identificar al usuario por su identificador de Google si ya está vinculado y, si no, por su correo normalizado (minúsculas, sin espacios), vinculando entonces el identificador.
- **FR-006**: La vinculación MUST auditarse como efecto de la propia escritura (actor = uid del usuario; sin correo ni identificador de Google) y deshacerse si la auditoría falla.
- **FR-007**: Solo los usuarios con estado `activo` MUST poder usar operaciones no públicas; el resto, 403 genérico.
- **FR-008**: Sin identidad o con identidad inválida MUST responder 401; fuera de la lista, correo sin verificar, inactivo o vinculación distinta, 403 con un cuerpo idéntico que no revele si el correo existe.
- **FR-009**: El rol MUST leerse de la lista en cada petición; nada de lo que envía el cliente lo determina.
- **FR-010**: Toda operación no pública MUST pasar por un único punto de comprobación de identidad y rol.
- **FR-011**: Los registros, errores y respuestas MUST NOT contener correos, identificadores de Google ni identidades.
- **FR-012**: El sistema MUST limitar las peticiones por usuario a 60 por minuto en las operaciones no públicas y responder 429 al superarlo.
- **FR-013**: "Quién soy" MUST devolver solo el rol del usuario.
- **FR-014**: La lista MUST guardar solo uid aleatorio, correo normalizado, identificador de Google, rol, estado y fechas de alta y baja.
- **FR-015**: La web MUST mostrar al usuario si ha entrado y su rol, y permitirle salir (olvidar la identidad en memoria).

### Key Entities

- **Usuario (lista cerrada)**: una persona autorizada. uid aleatorio (clave, la única correspondencia con la persona), correo normalizado, identificador de Google (vacío hasta el primer login), rol (`comunero` o `directiva`), estado (`activo`, `baja`, `suprimido`), fechas de alta y baja.
- **Entrada de auditoría**: la ya existente; la vinculación genera `usuario.vincular` con el uid como actor y clave, y antes/después solo `{ vinculado: false/true }`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario de la lista entra en menos de 10 segundos desde que abre `/login` (dos toques: botón y cuenta).
- **SC-002**: El 100 % de las operaciones no públicas rechazan peticiones sin identidad válida (comprobado por test para cada una).
- **SC-003**: Ningún registro, error, respuesta o entrada de auditoría generado en las pruebas contiene un correo o un identificador de Google.
- **SC-004**: Las respuestas a un correo fuera de la lista y a un usuario de baja son indistinguibles.

## Assumptions

- Roles con los nombres de `docs/producto.md`: `comunero` (el "vecino" del resumen del chat) y `directiva` (el "admin"). Pendiente de la confirmación de Rafa sobre lista cerrada (ver decisión en el PR).
- Sin sesión propia en servidor: la "sesión" es la identidad de Google en memoria del navegador (hasta 1 h o recargar la página), como exigen la constitución IV y la propuesta RGPD ("ID token validado en cada Function y no almacenado").
- El alta, la baja y la supresión de usuarios, el registro de actividades y la nota de umbral de EIPD van en un cambio siguiente; hasta entonces no hay usuarios reales en la tabla.
- El límite de peticiones es por instancia de la API (memoria); con el tráfico de la urbanización basta.
- El texto de la cláusula es la propuesta de Rai, marcada como pendiente de validar; los huecos (correo de la comunidad, proveedor de correo) quedan señalados.
- La SWA está provisionalmente fuera de la UE: solo pruebas, sin datos reales de vecinos.
- Rafa crea el cliente OAuth de Google (gratuito) y su identificador, que es público, se configura en la aplicación.
