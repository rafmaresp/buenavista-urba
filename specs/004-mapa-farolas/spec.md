# Feature Specification: Mapa de farolas en solo lectura

**Feature Branch**: `claude/project-thread-btefzp`

**Created**: 2026-11-15

**Status**: Draft (resumen aprobado por Rafa en el chat del proyecto el 2026-11-15)

**Input**: User description: "Cambio 3 del roadmap, mapa-farolas. Mapa público de solo lectura para visitantes y comuneros de Buenavista I (Dos Hermanas). Leaflet con dos capas base: Ortofoto PNOA del IGN (por defecto) y Callejero OSM, con selector de capa y su atribución; Leaflet empaquetado con la app (autohospedado, sin CDN ni fuentes externas). Centrado en Buenavista I y pensado primero para el móvil. Carga las 70 farolas (F01–F70) desde GET /api/farolas (ya existe, anónimo, sin precisión) y las pinta como puntos con su código. Al tocar una farola sale una ficha con su código y su calle (el estado de la incidencia llega con el cambio de reportar incidencias; en este cambio no hay incidencias). Si la carga falla, se muestra un error visible con opción de reintentar. Sin login ni escritura, sin datos personales nuevos, sin auditoría (no escribe). Fuera: login, reportar, incidencias, baches, avisos, precisión de posición. Pruebas: unitarias con Vitest y e2e con Playwright contra la CLI de SWA (carga, 70 marcadores, ficha, error de carga)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver las farolas sobre el mapa (Priority: P1)

Un vecino abre la web desde el móvil, sin iniciar sesión, y ve la urbanización Buenavista I sobre la ortofoto con un punto por cada farola y su código (F01…F70).

**Why this priority**: Es la base de todo lo demás: reportar una farola fundida (cambio siguiente) empieza por localizarla en el mapa.

**Independent Test**: Abrir la página principal y contar 70 marcas de farola sobre el mapa, centrado en la urbanización.

**Acceptance Scenarios**:

1. **Given** el catálogo tiene 70 farolas, **When** un visitante abre la página principal, **Then** ve el mapa centrado en Buenavista I con la ortofoto como fondo y 70 marcas de farola.
2. **Given** el mapa cargado, **When** el visitante acerca el zoom, **Then** cada marca muestra el código de su farola.
3. **Given** un móvil en vertical, **When** se abre la página, **Then** el mapa ocupa la pantalla disponible sin desplazamiento horizontal y se maneja con los dedos (arrastrar y pellizcar).

---

### User Story 2 - Consultar una farola (Priority: P2)

El vecino toca una farola y ve una ficha con su código y su calle, para saber con certeza de qué farola se trata.

**Why this priority**: Identificar la farola sin ambigüedad es lo que evitará avisos sobre la farola equivocada.

**Independent Test**: Tocar una marca y comprobar que la ficha muestra el código y la calle de esa farola.

**Acceptance Scenarios**:

1. **Given** el mapa cargado, **When** el visitante toca la farola F01, **Then** aparece una ficha con "F01" y su calle.
2. **Given** una ficha abierta, **When** el visitante toca otra farola, **Then** la ficha pasa a mostrar la nueva farola.

---

### User Story 3 - Cambiar entre ortofoto y callejero (Priority: P3)

El vecino cambia el fondo a callejero para leer nombres de calles y vuelve a la ortofoto.

**Why this priority**: Ayuda a orientarse, pero el mapa ya es útil solo con la ortofoto.

**Independent Test**: Usar el selector de capas y comprobar que el fondo cambia y que la atribución corresponde a la capa activa.

**Acceptance Scenarios**:

1. **Given** el mapa con la ortofoto, **When** el visitante elige "Callejero" en el selector, **Then** el fondo pasa al callejero y se ve su atribución (© OpenStreetMap).
2. **Given** cualquier capa, **When** se mira la esquina del mapa, **Then** se ve la atribución de la capa activa (PNOA © IGN u © OpenStreetMap).

---

### User Story 4 - Saber que algo ha fallado (Priority: P3)

Si el catálogo no se puede cargar, el vecino ve un aviso claro y puede reintentar, en lugar de un mapa vacío que parece no tener farolas.

**Why this priority**: Un mapa sin farolas sin explicación hace pensar que no hay nada que reportar.

**Independent Test**: Simular que el catálogo responde con error y comprobar el aviso y el botón de reintentar.

**Acceptance Scenarios**:

1. **Given** el catálogo responde con error, **When** se abre la página, **Then** se ve un aviso "No se pudieron cargar las farolas" con un botón "Reintentar".
2. **Given** el aviso de error, **When** el catálogo vuelve a responder y el visitante pulsa "Reintentar", **Then** desaparece el aviso y se pintan las farolas.

---

### Edge Cases

- El catálogo devuelve menos farolas de las esperadas: se pintan las que lleguen, sin error (el número lo garantiza la carga del catálogo, no el mapa).
- Sin conexión con el servidor de teselas: el mapa muestra el fondo vacío pero las farolas siguen visibles y se pueden tocar.
- Mientras carga el catálogo: se ve un indicador de "Cargando farolas…".
- Una respuesta con un formato inesperado se trata como error de carga.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La página principal MUST mostrar un mapa centrado en Buenavista I (Dos Hermanas) que se vea sin iniciar sesión.
- **FR-002**: El mapa MUST ofrecer dos fondos, Ortofoto PNOA (IGN, por defecto) y Callejero OSM, con un selector para cambiar entre ellos y la atribución de cada uno.
- **FR-003**: El mapa MUST pintar una marca por cada farola del catálogo público, en su posición.
- **FR-004**: Cada marca MUST mostrar el código de la farola (etiqueta visible a partir de un nivel de zoom cercano) y ser accesible por su código.
- **FR-005**: Al tocar una marca, el sistema MUST mostrar una ficha con el código y la calle de la farola.
- **FR-006**: Si el catálogo no se puede cargar, el sistema MUST mostrar un aviso visible con opción de reintentar.
- **FR-007**: El mapa MUST ser utilizable en un móvil en vertical (pantalla completa, gestos táctiles, controles al alcance del dedo).
- **FR-008**: La librería del mapa y sus estilos MUST servirse desde la propia web; solo las teselas de fondo salen de IGN y OSM.
- **FR-009**: La página MUST NOT escribir datos, pedir datos personales ni usar cookies o analítica.

### Key Entities

- **Farola (pública)**: código (F01–F70), calle y posición. Sin precisión de la posición, que es interna.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con el catálogo completo, un visitante ve las 70 farolas sin iniciar sesión.
- **SC-002**: Un vecino encuentra y abre la ficha de una farola concreta en menos de 30 segundos desde que abre la página en el móvil.
- **SC-003**: Ante un fallo del catálogo, el 100 % de las veces se muestra el aviso de error en lugar de un mapa sin farolas sin explicación.
- **SC-004**: La página no hace ninguna petición a dominios distintos del propio, IGN y OSM.

## Assumptions

- `GET /api/farolas` (cambio catálogo de farolas) ya está desplegado y devuelve `{ farolas: [{ id, calle, lat, lon }] }`.
- La ficha muestra código y calle. El estado de la incidencia de la farola se añade con el cambio de reportar incidencias, que es el que crea incidencias; aquí no existe todavía.
- Las teselas de PNOA y OSM se piden a sus servidores públicos; esos servidores reciben la IP del visitante (ya recogido en `docs/rgpd/propuesta-rgpd-v1.md`, la mención en la política llega con `/privacidad` en el cambio de login).
- Centro del mapa: 37.3165, -5.9606, zoom 17 (el del prototipo).
- Fuera de alcance: login, reportar, incidencias, votos, baches, avisos por correo y la precisión de la posición.
