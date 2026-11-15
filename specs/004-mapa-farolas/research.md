# Research: Mapa de farolas en solo lectura

## 1. Cómo integrar Leaflet en Angular

- **Decision**: `leaflet` 1.9.4 desde npm, usado directamente en un componente standalone (`afterNextRender` crea el mapa; `ngOnDestroy` lo elimina). CSS de Leaflet en `angular.json > styles`.
- **Rationale**: es lo más simple, autohospedado (lo exige `docs/producto.md`) y sin dependencias intermedias que actualizar.
- **Alternatives considered**: `@bluehalo/ngx-leaflet` (otra dependencia que sigue las versiones de Angular, sin ganancia para una sola pantalla); Leaflet desde CDN como el prototipo (descartado: la CSP solo permite `'self'` y el producto pide autohospedar); Leaflet 2.0 (aún en alfa).

## 2. Marcas: `circleMarker` (SVG) o `marker` con `divIcon` (DOM)

- **Decision**: `L.marker` con `L.divIcon` (punto + etiqueta con el código, `title="Farola F01"`, enfocable y pulsable con teclado).
- **Rationale**: cada farola es un elemento DOM con nombre accesible, lo que permite contarlas y tocarlas en los tests e2e y unitarios (jsdom no implementa SVG ni canvas, así que `circleMarker` no se puede probar fuera del navegador). 70 elementos DOM no afectan al rendimiento.
- **Alternatives considered**: `circleMarker` + `bindTooltip` como el prototipo (más ligero visualmente, pero sin nombre accesible y no probable en jsdom).

## 3. Etiquetas del código según el zoom

- **Decision**: la etiqueta existe siempre en el DOM; una clase en el contenedor del mapa la muestra a partir de zoom 18 (a zoom 17 con 70 etiquetas se solapan).
- **Alternatives considered**: tooltips permanentes recreados en cada `zoomend` (prototipo): más código y más trabajo en cada zoom.

## 4. Ficha de la farola

- **Decision**: popup de Leaflet con contenido construido con `textContent` (código y calle), nunca HTML interpolado.
- **Rationale**: evita inyección aunque la calle venga de la API; no necesita estilos de componente.
- **Alternatives considered**: panel inferior propio en Angular (mejor para el cambio de reportar, que añadirá acciones; se reevaluará allí).

## 5. Cargar el catálogo: `HttpClient` o `fetch`

- **Decision**: `fetch` envuelto en una función pura `cargarFarolas(fetchFn)` que valida la forma de la respuesta.
- **Rationale**: no obliga a tocar `app.config.ts` (lo modifica el login en paralelo) y se prueba inyectando un `fetch` falso.
- **Alternatives considered**: `HttpClient` + `provideHttpClient` (estándar en Angular, pero añade un cambio en la configuración compartida; se puede migrar cuando el login añada interceptores).

## 6. CSP

- **Decision**: `default-src 'self'; img-src 'self' data: https://www.ign.es https://tile.openstreetmap.org`. Sin `'unsafe-inline'` en estilos: los estilos van en `styles.css` (extraído) y Leaflet solo modifica estilos por CSSOM (`element.style`), que la CSP no bloquea.
- **Alternatives considered**: `style-src 'unsafe-inline'` para permitir estilos de componente (debilita la CSP sin necesidad).
- OSM: se usa `tile.openstreetmap.org` sin subdominios `{s}` (recomendación actual de la política de uso de OSM). La `Referrer-Policy` actual envía el origen, que OSM exige.

## 7. e2e sin Azurite

- **Decision**: el e2e intercepta `/api/farolas` con `page.route` y responde con las 70 farolas leídas de `data/farolas_buenavista.csv`; también intercepta las teselas externas (respuesta vacía) para no depender de IGN/OSM en la CI.
- **Rationale**: el job `e2e` de la CI no tiene Azurite ni datos sembrados, y `AGENTS.md` no permite tocar `.github/workflows/` sin pedirlo. La API real ya tiene tests de integración contra Azurite (cambio catálogo de farolas); el e2e prueba la web servida por la CLI de SWA con su `staticwebapp.config.json` (CSP incluida).
- **Alternatives considered**: añadir Azurite y la siembra al job `e2e` (más fiel, pero toca workflows; se propone como mejora aparte).

## 8. Centro y zoom

- **Decision**: centro 37.3165, -5.9606, zoom 17 (prototipo), `maxZoom` 20 con `maxNativeZoom` 19 en ambas capas.
