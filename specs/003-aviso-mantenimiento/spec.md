# Feature Specification: Aviso de mantenimiento programado en el mapa

**Feature Branch**: `claude/issue-12-20261114-2308`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "La directiva quiere publicar un aviso de mantenimiento programado (fecha, hora y texto corto) que se muestre como banner en el mapa a todos los visitantes hasta que pase la fecha. Solo la directiva puede crear o quitar el aviso."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el aviso vigente en el mapa (Priority: P1)

Cualquier visitante (con o sin sesión) que abre el mapa ve, en un banner, el aviso de mantenimiento programado: fecha, hora y texto corto. El banner desaparece solo cuando pasa la fecha y hora del aviso.

**Why this priority**: es el valor de la feature: que los vecinos sepan de antemano que habrá un corte o mantenimiento. Sin esto, crear avisos no sirve de nada.

**Independent Test**: con un aviso ya guardado y fecha futura, abrir el mapa sin iniciar sesión y comprobar que el banner muestra fecha, hora y texto. Con la fecha ya pasada, comprobar que no aparece.

**Acceptance Scenarios**:

1. **Given** un aviso con fecha y hora futuras, **When** un visitante anónimo abre el mapa, **Then** ve el banner con la fecha, la hora y el texto del aviso.
2. **Given** un aviso cuya fecha y hora ya han pasado, **When** cualquiera abre el mapa, **Then** no se muestra ningún banner.
3. **Given** que no hay ningún aviso, **When** se abre el mapa, **Then** el mapa se muestra igual que hoy, sin banner ni hueco vacío.
4. **Given** que falla la consulta del aviso, **When** se abre el mapa, **Then** el mapa sigue funcionando sin banner y sin error visible para el visitante.

---

### User Story 2 - La directiva publica un aviso (Priority: P2)

Un miembro de la directiva con sesión iniciada rellena fecha, hora y texto corto y publica el aviso. Desde ese momento lo ve cualquier visitante.

**Why this priority**: sin esta historia no hay avisos que mostrar, pero la lectura (P1) se puede probar con un aviso sembrado.

**Independent Test**: iniciar sesión como directiva, publicar un aviso con fecha futura y comprobar que un visitante anónimo lo ve; comprobar que un comunero o un visitante no pueden publicarlo.

**Acceptance Scenarios**:

1. **Given** una persona con rol directiva, **When** publica un aviso con fecha y hora futuras y un texto válido, **Then** el aviso queda guardado y el mapa lo muestra a todos.
2. **Given** una persona con rol comunero, o sin sesión, **When** intenta publicar un aviso, **Then** se rechaza y no se guarda nada.
3. **Given** un texto vacío, demasiado largo o una fecha ya pasada, **When** la directiva intenta publicar, **Then** se rechaza con un mensaje que dice qué corregir.
4. **Given** que ya hay un aviso vigente, **When** la directiva publica otro, **Then** [NEEDS CLARIFICATION: ¿solo puede haber un aviso a la vez (el nuevo sustituye al anterior) o pueden convivir varios?].

---

### User Story 3 - La directiva quita un aviso (Priority: P3)

La directiva retira un aviso antes de que pase su fecha (por ejemplo, si el mantenimiento se cancela). El banner deja de mostrarse a todos.

**Why this priority**: es una corrección útil, pero el aviso caduca solo, así que el flujo básico funciona sin ella.

**Independent Test**: con un aviso vigente, quitarlo como directiva y comprobar que un visitante ya no ve el banner; comprobar que un comunero no puede quitarlo.

**Acceptance Scenarios**:

1. **Given** un aviso vigente, **When** la directiva lo quita, **Then** el mapa deja de mostrarlo a todos.
2. **Given** una persona sin rol directiva, **When** intenta quitar el aviso, **Then** se rechaza y el aviso sigue visible.

---

### Edge Cases

- El aviso caduca mientras un visitante tiene el mapa abierto: el banner puede seguir visible hasta la siguiente carga; no se exige retirarlo en vivo.
- Dos personas de la directiva publican o quitan a la vez: el resultado final es coherente (nunca dos avisos si la respuesta a la pregunta de unicidad es "uno solo").
- Fecha y hora se interpretan y se muestran en la hora local de Dos Hermanas (Europa/Madrid), incluido el cambio de hora.
- Texto con HTML o enlaces: se muestra siempre como texto plano.
- Quitar un aviso inexistente o ya caducado no da error al usuario.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El mapa MUST mostrar a cualquier visitante, sin iniciar sesión, un banner con la fecha, la hora y el texto del aviso vigente.
- **FR-002**: Un aviso MUST considerarse vigente hasta su fecha y hora; pasada esa hora, el banner MUST dejar de mostrarse sin intervención de nadie.
- **FR-003**: Sin aviso vigente, el mapa MUST mostrarse sin banner; un fallo al obtener el aviso MUST NOT impedir usar el mapa.
- **FR-004**: Solo una persona con rol directiva MUST poder crear un aviso; la comprobación MUST hacerse en el servidor.
- **FR-005**: Solo una persona con rol directiva MUST poder quitar un aviso; la comprobación MUST hacerse en el servidor.
- **FR-006**: El texto del aviso MUST ser texto plano, obligatorio y de como máximo 140 caracteres; la fecha y hora MUST ser obligatorias y posteriores al momento de publicar.
- **FR-007**: La lectura del aviso MUST ser anónima y no devolver ningún dato de quien lo creó.
- **FR-008**: Cada creación y cada retirada de un aviso MUST generar una entrada de auditoría (quién por `uid`, qué, cuándo, antes y después) en la misma operación, sin guardar el texto en claro más allá de lo que fije el contrato de auditoría del proyecto.
- **FR-009**: Los avisos caducados MUST dejar de mostrarse; su conservación o borrado posterior [NEEDS CLARIFICATION: ¿se conservan los avisos caducados como historial o se borran al caducar?].
- **FR-010**: La directiva MUST poder ver el aviso vigente y disponer de controles para publicarlo o quitarlo; los demás roles MUST NOT ver esos controles.

### Key Entities

- **Aviso de mantenimiento**: mensaje público de la directiva. Atributos: fecha y hora del mantenimiento, texto corto, momento de creación y autor (`uid` opaco, solo interno/auditoría, nunca expuesto).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante anónimo ve el aviso vigente en el mapa sin ninguna acción adicional, en la misma carga de la página.
- **SC-002**: Tras publicar o quitar un aviso, los visitantes lo ven aparecer o desaparecer en 1 minuto como máximo.
- **SC-003**: El 100 % de los intentos de crear o quitar un aviso por parte de quien no es directiva se rechazan y no cambian nada.
- **SC-004**: Pasada la fecha y hora del aviso, ningún visitante que cargue el mapa después lo ve.
- **SC-005**: La directiva publica un aviso en menos de 1 minuto desde que abre el formulario.

## Assumptions

- Depende de que existan el mapa público (`docs/roadmap.md`, cambio 3) y el login con roles (cambio 4); sin ellos no hay dónde mostrar el banner ni forma de reconocer a la directiva. No está en el roadmap actual: Rafa decide su orden.
- Un aviso es solo informativo: no bloquea ni cambia el comportamiento del mapa ni de las incidencias.
- El aviso no contiene datos personales; el texto es libre pero se avisa a la directiva de no escribir datos de terceros.
- Se muestra en español de España y en la hora de Europa/Madrid.
- Fuera de alcance: avisos por correo, programar avisos con inicio futuro, avisos con enlaces o formato, historial navegable, varios idiomas y que el visitante pueda cerrar el banner (salvo que Rafa lo pida).
- Requiere una tabla nueva en Table Storage, declarada en Bicep, sin coste adicional apreciable.
