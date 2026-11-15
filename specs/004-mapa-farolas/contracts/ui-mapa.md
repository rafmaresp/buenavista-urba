# Contrato de interfaz: mapa de farolas

Lo que los tests e2e (y los cambios siguientes) pueden dar por hecho.

| Elemento | Selector / nombre accesible |
|---|---|
| Contenedor del mapa | `region` con nombre "Mapa de farolas" |
| Marca de farola | botón con título `Farola Fnn` (clase `farola-marca`) |
| Etiqueta del código | texto `Fnn` dentro de la marca; visible desde zoom 18 |
| Ficha | popup de Leaflet con `Fnn` (encabezado) y la calle |
| Selector de capas | radios "Ortofoto" (marcado por defecto) y "Callejero" |
| Atribución | "PNOA © IGN" u "© OpenStreetMap" según la capa |
| Cargando | `status` con "Cargando farolas…" |
| Error | `alert` con "No se pudieron cargar las farolas" y botón "Reintentar" |
