# Feature Specification: Catálogo de farolas

**Feature Branch**: `claude/project-thread-chd9ja` (issue #17)

**Created**: 2026-11-15

**Status**: Draft (resumen aprobado por Rafa en el chat del proyecto el 2026-11-15)

**Input**: User description: "Catálogo de farolas (cambio 2 del roadmap, `catalogo-farolas`, issue #17). Las 70 farolas F01–F70 de Buenavista I pasan a la tabla `Farolas` y se exponen con `GET /api/farolas`, anónimo y cacheable 5 minutos, con id, calle, lat y lon y nunca la precisión. La carga inicial es una siembra tipo migración (workflow manual "Cargar farolas") que da de alta solo las farolas que faltan y nunca sobrescribe una existente. Toda escritura se audita con un módulo `auditar()` reutilizable (actor, acción, entidad, clave, antes, después, fecha; partición por mes; campos prohibidos; se audita antes de escribir). Opción A: un SAS de servicio por tabla; `Farolas` solo lectura para la app, `Auditoria` solo añadir y leer; se elimina el SAS de cuenta. F62 entra en el CSV como farola normal. Fuera: mapa, login, precisión para la directiva, reubicar (`PUT`) y crear (`POST`) farola, que van en el cambio 8."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar el catálogo de farolas (Priority: P1)

Cualquier persona, sin iniciar sesión, obtiene la lista de las 70 farolas de la urbanización con su identificador, su calle y su posición, para que el mapa (cambio 3) pueda pintarlas.

**Why this priority**: es lo que aporta valor visible y lo que desbloquea el mapa público y el reporte de incidencias.

**Independent Test**: con la tabla sembrada, pedir el catálogo sin credenciales y comprobar que llegan 70 farolas `F01`–`F70` con id, calle, latitud y longitud, y ningún dato de precisión.

**Acceptance Scenarios**:

1. **Given** el catálogo sembrado, **When** un visitante sin sesión pide el catálogo, **Then** recibe las 70 farolas ordenadas por identificador, cada una con id, calle, latitud y longitud.
2. **Given** el catálogo sembrado, **When** se pide el catálogo, **Then** la respuesta no contiene la precisión de ninguna farola ni ningún otro campo interno.
3. **Given** el catálogo sembrado, **When** se pide el catálogo, **Then** la respuesta indica que puede reutilizarse durante 5 minutos (caché pública).
4. **Given** que el almacenamiento no responde, **When** se pide el catálogo, **Then** se devuelve un error genérico sin detalles internos y la respuesta no se cachea.

---

### User Story 2 - Sembrar el catálogo desde la semilla (Priority: P1)

Rafa (o un dev) lanza a mano la carga de farolas en un entorno; la carga da de alta las farolas de la semilla que aún no existen, deja intactas las que ya están y registra cada alta en la auditoría.

**Why this priority**: sin la siembra no hay catálogo que consultar; es la "migración de datos" del entorno.

**Independent Test**: sobre un almacenamiento vacío, ejecutar la carga y comprobar 70 farolas y 70 entradas de auditoría; ejecutarla otra vez y comprobar que nada cambia.

**Acceptance Scenarios**:

1. **Given** un catálogo vacío, **When** se ejecuta la carga, **Then** quedan 70 farolas y 70 entradas de auditoría de alta con actor `sistema:carga`.
2. **Given** un catálogo ya sembrado, **When** se vuelve a ejecutar la carga, **Then** no se crea, modifica ni audita nada y la carga informa de 0 altas.
3. **Given** una farola existente cuya posición difiere de la semilla (por ejemplo, reubicada), **When** se ejecuta la carga, **Then** esa farola conserva su posición y la carga no la toca.
4. **Given** un catálogo con algunas farolas, **When** se ejecuta la carga, **Then** solo se dan de alta (y se auditan) las que faltan.
5. **Given** una semilla con errores (fila con id fuera de `F01`–`F70`, coordenada no numérica o fuera de la urbanización, id repetido o recuento distinto de 70), **When** se ejecuta la carga, **Then** se detiene antes de escribir nada e informa de la fila con el problema.

---

### User Story 3 - Auditoría a prueba de manipulación (Priority: P2)

Toda escritura de datos deja una entrada de auditoría (quién, qué, cuándo, antes, después) que la propia aplicación no puede modificar ni borrar, y que nunca contiene datos personales.

**Why this priority**: es un principio de la constitución (III) que aplica desde la primera escritura; los cambios siguientes reutilizan el mismo mecanismo.

**Independent Test**: generar una entrada con la credencial de la aplicación y comprobar que se puede leer, pero que modificarla o borrarla se rechaza; intentar auditar con un campo prohibido y comprobar que se rechaza sin escribir nada.

**Acceptance Scenarios**:

1. **Given** una escritura de datos, **When** se audita, **Then** la entrada guarda actor, acción, entidad, clave, estado anterior, estado posterior y fecha, agrupada por mes.
2. **Given** la credencial de la aplicación, **When** se intenta modificar o borrar una entrada de auditoría, **Then** la operación se rechaza.
3. **Given** la credencial de la aplicación, **When** se intenta escribir en el catálogo de farolas, **Then** la operación se rechaza (la aplicación solo lee farolas en este cambio).
4. **Given** un estado anterior o posterior con un campo prohibido (email, sub, nombre, comentario) o con un valor con forma de email, **When** se intenta auditar, **Then** se rechaza y la escritura de datos no se hace.
5. **Given** un actor que no es `uid` opaco, `sistema:<nombre>` ni `dev:<alias>`, **When** se intenta auditar, **Then** se rechaza.
6. **Given** que la auditoría falla, **When** se iba a escribir un dato, **Then** el dato no se escribe.

---

### Edge Cases

- F62 no tiene coordenadas medidas: entra en la semilla como una farola más (posición `estimada`, punto medio de F61 y F63); su origen se documenta fuera de los datos.
- La carga se interrumpe a mitad: al relanzarla da de alta solo las que faltan. Si quedó una entrada de auditoría de alta sin farola (la auditoría va antes que la escritura), la nueva ejecución añade otra entrada para esa farola; se acepta como rastro de un intento.
- Dos cargas a la vez: la escritura de cada farola solo crea si no existe, así que la segunda falla para esa farola sin sobrescribir; la carga informa del conflicto.
- La semilla incluye una segunda tabla (tramos entre farolas) tras una línea en blanco: la carga solo lee las farolas.
- Catálogo vacío (infra desplegada pero carga no ejecutada): el catálogo devuelve una lista vacía, no un error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ofrecer el catálogo de farolas sin sesión, con id, calle, latitud y longitud de cada farola, ordenado por id.
- **FR-002**: El catálogo MUST NOT incluir la precisión de la posición ni ningún campo interno de almacenamiento.
- **FR-003**: El catálogo MUST poder cachearse públicamente durante 5 minutos; una respuesta de error MUST NOT cachearse.
- **FR-004**: Un error de almacenamiento MUST devolverse como error genérico, sin detalles internos.
- **FR-005**: La semilla (`data/farolas_buenavista.csv`) MUST contener exactamente 70 farolas, `F01`–`F70` sin huecos; F62 es una fila normal.
- **FR-006**: La carga MUST validar la semilla completa antes de escribir (ids, recuento, coordenadas numéricas dentro de la urbanización, posición `verificada` o `estimada`, sin duplicados) y no escribir nada si falla.
- **FR-007**: La carga MUST dar de alta solo las farolas que no existen y MUST NOT modificar una farola existente.
- **FR-008**: La carga MUST poder relanzarse sin efectos: una segunda ejecución no crea, modifica ni audita nada.
- **FR-009**: Cada alta de la carga MUST auditarse con actor `sistema:carga`, acción de alta, entidad `Farolas`, la clave de la farola, sin estado anterior y con el estado posterior completo (incluida la precisión, que no es dato personal).
- **FR-010**: La carga MUST lanzarse a mano desde GitHub en el entorno protegido de infraestructura, con una credencial temporal (≤ 1 h) limitada a las dos tablas, que nunca se guarda en el repo ni aparece en los registros.
- **FR-011**: Toda escritura de datos MUST auditarse antes de hacerse; si la auditoría falla, la escritura MUST NOT hacerse.
- **FR-012**: Cada entrada de auditoría MUST guardar actor, acción, entidad, clave, antes, después y fecha (UTC), agrupadas por mes (`AAAA-MM`) para poder purgarlas por meses.
- **FR-013**: El actor MUST ser un `uid` opaco (UUID), `sistema:<nombre>` o `dev:<alias>`; cualquier otro valor se rechaza.
- **FR-014**: La auditoría MUST rechazar estados anterior o posterior con campos prohibidos (email, sub, nombre, comentario, en cualquier nivel) o con valores con forma de email.
- **FR-015**: La credencial de la aplicación MUST permitir solo leer `Farolas` y solo añadir y leer `Auditoria`; modificar o borrar auditoría, escribir farolas o crear y borrar tablas MUST rechazarse.
- **FR-016**: La credencial de cuenta anterior (una sola para todas las tablas) MUST eliminarse de la configuración de la aplicación.
- **FR-017**: Las tablas `Farolas` y `Auditoria` MUST declararse en la infraestructura como código, y las tablas que usa el código MUST coincidir con las declaradas (comprobado por test).
- **FR-018**: El orden de despliegue MUST documentarse: infraestructura, después la carga y por último la aplicación.

### Key Entities

- **Farola**: elemento del alumbrado. Atributos: id (`F01`–`F70`), calle, latitud, longitud, precisión de la posición (`verificada` ±2–3 m o `estimada` ±5–8 m; interna, no se expone en este cambio).
- **Entrada de auditoría**: registro inmutable de una escritura. Atributos: mes, momento, actor, acción, entidad, clave, antes, después. Nunca datos personales ni texto libre.
- **Semilla**: el CSV versionado con las 70 farolas; fuente de la carga inicial, no de la posición vigente (que vive en el catálogo).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras la carga en un entorno vacío, el catálogo devuelve 70 de 70 farolas (`F01`–`F70`) y la auditoría tiene exactamente 70 entradas de alta.
- **SC-002**: Una segunda carga produce 0 altas, 0 modificaciones y 0 entradas de auditoría nuevas.
- **SC-003**: El 100 % de los intentos de modificar o borrar la auditoría, o de escribir farolas, con la credencial de la aplicación se rechazan.
- **SC-004**: Ninguna respuesta del catálogo contiene la precisión de una farola.
- **SC-005**: Una petición repetida al catálogo dentro de 5 minutos puede servirse desde caché sin llegar a la aplicación.

## Assumptions

- La identidad de quien lanza la carga ya existe (`id-buenavista-infra`, entorno `infra` con aprobación de Rafa) y tiene permiso para obtener las claves de la cuenta de Storage y firmar la credencial temporal.
- Las farolas no son datos personales; la carga puede ejecutarse con la aplicación provisional fuera de la UE (decisión del 2026-11-15) sin conflicto con el RGPD.
- La aplicación no escribe todavía nada: la escritura de farolas (reubicar con `PUT`, crear con `POST`) llega en el cambio 8, tras el login (cambio 4), y ampliará entonces el permiso de `Farolas`.
- La precisión de F62 (inferida, ±20 m) queda como nota en `docs/producto.md`; en los datos es `estimada`, por decisión de Rafa ("una farola es una farola").
- El emulador local de almacenamiento usado en la CI admite credenciales por tabla con los mismos permisos que Azure; lo que no se pueda probar allí se verifica en Azure tras el primer despliegue.
- Fuera de alcance: mapa (cambio 3), login (cambio 4), precisión visible para la directiva, reubicar y crear farola (cambio 8), purga de auditoría (cambio 11).
