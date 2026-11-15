# Research: Reubicar farola (directiva)

## R1. Concurrencia: ETag de Table Storage

- **Decision**: `reubicar()` lee la entidad (`getEntity`) y la actualiza con `updateEntity(..., 'Merge', { etag })`. Si otra escritura cambió la fila, Table Storage responde 412 y el repositorio lanza `FarolaCambiada` (HTTP 409).
- **Rationale**: el "antes" de la auditoría tiene que ser exactamente lo que se sobrescribe; sin ETag dos reubicaciones simultáneas auditarían el mismo "antes" y una pisaría a la otra en silencio.
- **Alternatives considered**: `etag: '*'` (último gana; la auditoría quedaría inconsistente); que el cliente mande el ETag (expone un detalle de almacenamiento y obliga a ampliar el `GET` público).

## R2. Deshacer si la auditoría falla

- **Decision**: si `auditar()` falla, se restaura `{lat, lon, precision}` anteriores con `updateEntity` en `Merge` condicionado al ETag que devolvió la propia actualización. Si la restauración falla (incluido un 412 porque alguien escribió entretanto), se lanza `ReubicacionSinAuditar` para revisar a mano.
- **Rationale**: mismo patrón que `crear()` (decisión 2026-11-15 "la auditoría es un efecto de la capa de datos"); el ETag evita deshacer el cambio de otro.
- **Alternatives considered**: auditar antes de escribir (dejaría entradas de cambios que no ocurrieron si la escritura falla); cola asíncrona (descartada en la decisión del 2026-11-15).

## R3. Permisos del SAS de `Farolas`

- **Decision**: `signedPermission: 'ru'` (leer y actualizar).
- **Rationale**: `updateEntity` y la restauración necesitan `u`; añadir (`a`) llega con `POST` y borrar (`d`) no hace falta. El roadmap preveía `rau` para el cambio completo; aquí solo se amplía lo que se usa.
- **Alternatives considered**: `rau` ya (permiso sin uso); SAS aparte solo para escribir (dos cadenas para una tabla, sin ganancia real: la Function que lee es la misma que escribe).

## R4. Precisión tras reubicar

- **Decision**: siempre `verificada`.
- **Rationale**: la directiva coloca la marca sobre la ortofoto o en campo; `docs/producto.md` dice que reubicar "fija su precisión". Preguntarla en cada movimiento añade un paso sin valor mientras la precisión no se muestre a nadie.
- **Alternatives considered**: elegir la precisión en la confirmación (se puede añadir con la vista de precisión para la directiva).

## R5. Arrastre en el mapa

- **Decision**: `marker.dragging.enable()` de Leaflet solo sobre la marca elegida con "Mover" en la ficha; al `dragend` se muestra una barra fija bajo el mapa con "¿Mover F07 aquí?", Guardar y Cancelar. Las demás marcas no se arrastran.
- **Rationale**: Leaflet ya soporta arrastre con ratón y dedo; activarlo solo tras "Mover" evita arrastres accidentales al desplazar el mapa en el móvil. La barra fuera del popup no depende del ciclo de vida del popup, que se cierra al arrastrar.
- **Alternatives considered**: todas las marcas arrastrables para la directiva (arrastres accidentales); tocar en el mapa para colocar (menos preciso y más código); `window.confirm` (bloquea la página y rompe la automatización e2e).

## R6. Caché del catálogo

- **Decision**: se mantiene `Cache-Control: public, max-age=300` en `GET /api/farolas`.
- **Rationale**: la farola movida se ve al momento en la sesión de quien la mueve (la marca no se recarga); el resto la ve como mucho a los 5 minutos (SC-005). Las reubicaciones son raras.
- **Alternatives considered**: `no-cache` (más lecturas en cada visita para un caso raro).

## R7. e2e con sesión de directiva

- **Decision**: el e2e simula Google Identity Services con `addInitScript` (un `window.google` falso cuyo botón llama al callback), `/api/config`, `/api/yo` (`directiva`) y el `PUT`, y arrastra la marca con el ratón. Otro test llama al `PUT` real sin token y espera 401.
- **Rationale**: los usuarios de prueba con sesión contra la API real siguen pendientes de diseño (Rai); la API real ya la cubren las unitarias y la integración contra Azurite.
- **Alternatives considered**: esperar a los usuarios de prueba (dejaría el flujo de la web sin e2e).
