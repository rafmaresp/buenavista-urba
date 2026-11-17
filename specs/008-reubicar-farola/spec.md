# Feature Specification: Reubicar farola (directiva)

**Feature Branch**: `claude/project-thread-2yclir`

**Created**: 2026-11-15

**Status**: Draft (resumen aprobado por Rafa en el chat del proyecto)

**Input**: User description: "Reubicar farola (directiva). Quien tiene sesión con rol directiva puede corregir la posición de una farola del catálogo arrastrando su marca en el mapa; al soltarla, la app pide confirmación (¿Mover F07 aquí? con Guardar y Cancelar) y solo al confirmar guarda la nueva posición. Cancelar devuelve la marca a su sitio. El servidor identifica al usuario en cada petición, exige rol directiva, valida el código, que la farola existe y que la posición cae dentro de la urbanización. La posición movida por la directiva queda con precisión verificada. El cambio se audita como efecto de la escritura y se deshace si la auditoría falla. Si otro la movió entre medias, conflicto. Comunero y visitante no ven el control de mover. Fuera: crear farolas, ver la precisión, historial de posiciones en la app, editar la calle y borrar farolas."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La directiva corrige la posición de una farola (Priority: P1)

Un miembro de la directiva, con sesión, ve en el mapa que la farola F62 está a unos metros de donde está de verdad. Activa "Mover" en su ficha, arrastra la marca sobre la ortofoto hasta la farola real y suelta. La app le pregunta "¿Mover F62 aquí?"; pulsa Guardar y la marca se queda en la nueva posición. Cualquiera que abra el mapa después ve la farola en su sitio.

**Why this priority**: es el objetivo del cambio. Hay farolas con posición estimada (±5–8 m) y F62 con coordenadas inferidas; la carga inicial nunca modifica farolas existentes, así que la única forma de corregirlas es esta.

**Independent Test**: con una sesión de directiva, mover una farola, guardar y recargar el mapa: la farola aparece en la nueva posición y hay una entrada de auditoría con la posición anterior y la nueva.

**Acceptance Scenarios**:

1. **Given** una sesión de directiva y el mapa cargado, **When** abre la ficha de F07 y pulsa "Mover", **Then** la marca de F07 se puede arrastrar y la app indica que la arrastre a su sitio.
2. **Given** F07 en modo mover, **When** la suelta en otro punto, **Then** la app pregunta "¿Mover F07 aquí?" con Guardar y Cancelar, y todavía no se ha guardado nada.
3. **Given** la pregunta de confirmación, **When** pulsa Guardar y el servidor acepta, **Then** la marca queda en la nueva posición, deja de poder arrastrarse y la app confirma que se ha guardado.
4. **Given** una farola movida y guardada, **When** cualquier persona carga el mapa (pasada la caché pública de 5 minutos), **Then** la ve en la nueva posición.
5. **Given** una farola movida y guardada, **Then** queda una entrada de auditoría con quién (uid), qué (reubicación de esa farola), cuándo, la posición y precisión anteriores y las nuevas.

---

### User Story 2 - Cancelar o fallar no mueve nada (Priority: P1)

Quien está moviendo una farola se equivoca o se arrepiente: pulsa Cancelar y la marca vuelve a donde estaba. Si el servidor rechaza o no puede guardar, la marca también vuelve y se explica por qué.

**Why this priority**: un arrastre accidental en el móvil no debe cambiar el catálogo; sin esto, P1 no es seguro de usar.

**Independent Test**: arrastrar, cancelar y comprobar que la marca vuelve y que no se hizo ninguna petición de cambio; simular un rechazo del servidor y comprobar que la marca vuelve con un mensaje.

**Acceptance Scenarios**:

1. **Given** F07 arrastrada y la pregunta en pantalla, **When** pulsa Cancelar, **Then** la marca vuelve a su posición anterior y no se envía nada.
2. **Given** F07 en modo mover sin haberla soltado aún, **When** pulsa Cancelar, **Then** sale del modo mover sin cambios.
3. **Given** la confirmación, **When** el servidor responde que la sesión caducó o no tiene permiso, **Then** la marca vuelve y la app pide volver a entrar.
4. **Given** la confirmación, **When** otra persona movió la misma farola entretanto, **Then** la marca vuelve, la app avisa de que la farola cambió y pide recargar el mapa.
5. **Given** la confirmación, **When** el servidor no está disponible, **Then** la marca vuelve y la app pide intentarlo de nuevo.

---

### User Story 3 - Solo la directiva puede mover farolas (Priority: P1)

Un comunero o un visitante no ve el control "Mover" en la ficha y no puede arrastrar marcas. Aunque alguien intente guardar una posición directamente contra el servidor, sin rol directiva se rechaza.

**Why this priority**: es una zona sensible (roles y modelo de datos): la autorización vive en el servidor (constitución IV).

**Independent Test**: llamar al servicio de reubicación sin sesión, con sesión de comunero y con sesión de directiva; solo la última cambia la farola.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión, **When** abre la ficha de una farola, **Then** no ve "Mover" y la marca no se puede arrastrar.
2. **Given** un comunero con sesión, **When** abre la ficha, **Then** no ve "Mover".
3. **Given** una petición de reubicación sin sesión válida, **Then** se rechaza como no autenticada y la farola no cambia.
4. **Given** una petición de reubicación de un comunero, **Then** se rechaza sin acceso y la farola no cambia ni se audita nada.

---

### Edge Cases

- Posición fuera de la urbanización (fuera del recuadro de latitud y longitud del catálogo) o no numérica: se rechaza como petición no válida y no cambia nada.
- Código de farola con otro formato que F + 2 cifras: petición no válida.
- Farola que no existe en el catálogo: no encontrada; no se crea (crear farolas queda fuera).
- Cuerpo con campos de más (por ejemplo la calle): se ignoran; solo cambia la posición.
- Soltar la marca en el mismo sitio: se trata como cualquier otra posición (se guarda y se audita si se confirma).
- Dos miembros de la directiva mueven la misma farola a la vez: la segunda escritura detecta que la farola cambió desde que la leyó y se rechaza con conflicto; no se pisa el cambio de la primera.
- La auditoría falla tras guardar: se restaura la posición anterior y la operación falla. Si también falla restaurar, se registra un error propio para revisarlo a mano.
- La farola tiene una incidencia abierta: se puede mover igual; la incidencia sigue asociada al código.
- Con la ficha abierta en modo mover, el usuario cambia de capa o hace zoom: el modo mover sigue activo hasta Guardar o Cancelar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a un usuario con rol directiva cambiar la latitud y longitud de una farola existente del catálogo.
- **FR-002**: El sistema MUST comprobar en el servidor, en cada petición de reubicación, la identidad (lista cerrada y token válido) y el rol directiva; sin sesión responde no autenticado y con otro rol responde sin acceso, sin cambiar ni auditar nada.
- **FR-003**: El sistema MUST rechazar como no válida una petición cuyo código no sea F + 2 cifras, cuya latitud o longitud no sean números o caigan fuera de la urbanización (los mismos límites que valida la carga del catálogo).
- **FR-004**: El sistema MUST responder no encontrada si la farola no existe, y nunca crear una farola al reubicar.
- **FR-005**: Al reubicar, el sistema MUST cambiar solo la posición y fijar la precisión a "verificada"; el código y la calle no cambian.
- **FR-006**: Cada reubicación MUST generar, como efecto de la misma operación de datos, una entrada de auditoría con actor (uid), acción de reubicación, la farola, y antes/después con latitud, longitud y precisión; sin datos personales.
- **FR-007**: Si la auditoría falla, el sistema MUST restaurar la posición y la precisión anteriores y fallar; si la restauración también falla, MUST señalarlo con un error propio distinto de un fallo normal.
- **FR-008**: Si la farola cambió entre que el servidor la leyó y la escribe, el sistema MUST rechazar la reubicación con conflicto y no pisar el otro cambio.
- **FR-009**: El mapa MUST ofrecer "Mover" en la ficha de cada farola solo cuando la sesión es de directiva; sin sesión o con rol comunero, no hay control y las marcas no se arrastran.
- **FR-010**: En modo mover, al soltar la marca el mapa MUST pedir confirmación ("¿Mover F07 aquí?", Guardar y Cancelar) y solo al confirmar MUST enviar la nueva posición.
- **FR-011**: Cancelar o cualquier error al guardar MUST devolver la marca a la posición anterior y mostrar un mensaje según la causa (sesión, conflicto, no disponible).
- **FR-012**: Tras guardar, la marca MUST quedarse en la nueva posición sin recargar el mapa, y la ficha y el resto de funciones (incidencias) MUST seguir funcionando sobre la farola.
- **FR-013**: La respuesta pública del catálogo MUST seguir sin la precisión.
- **FR-014**: Los permisos de la aplicación sobre la tabla de farolas MUST ampliarse solo a lo necesario: leer y actualizar (no añadir ni borrar).

### Key Entities

- **Farola**: código (F + 2 cifras), calle, latitud, longitud y precisión (verificada o estimada, interna). Este cambio modifica latitud, longitud y precisión.
- **Entrada de auditoría**: actor (uid), acción `farola.reubicacion`, entidad Farolas, clave (código), antes y después `{lat, lon, precision}`, cuándo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro de la directiva corrige la posición de una farola en menos de 30 segundos desde que abre su ficha.
- **SC-002**: El 100 % de las reubicaciones guardadas tienen su entrada de auditoría con la posición anterior y la nueva; ninguna reubicación queda guardada sin auditar.
- **SC-003**: El 100 % de los intentos de reubicar sin rol directiva se rechazan sin cambiar el catálogo.
- **SC-004**: Ningún arrastre cancelado o fallido cambia la posición guardada.
- **SC-005**: Tras una reubicación, cualquier visitante ve la nueva posición en un máximo de 5 minutos (caché pública del catálogo).

## Assumptions

- La posición colocada por la directiva sobre la ortofoto se considera verificada; no se pregunta la precisión en cada movimiento (la decisión de producto dice "mueve la posición y fija su precisión").
- Crear farolas (`POST`) y ver la precisión en el catálogo para la directiva, previstos en el roadmap para el mismo cambio 8, quedan para otro cambio: Rafa aprobó solo la reubicación.
- La caché pública de 5 minutos del catálogo se mantiene; quien movió la farola la ve en su sitio al momento y el resto, como mucho, a los 5 minutos.
- Reutiliza el login, la lista cerrada y la identificación del cambio de login (spec 005), y el repositorio y la auditoría del catálogo (spec 003).
- Ampliar el SAS de la tabla de farolas es un cambio de infraestructura: al fusionar, el despliegue pide la aprobación de Rafa en el entorno `infra`.
- Se usa en móvil y escritorio: el arrastre funciona con el dedo y con el ratón.
