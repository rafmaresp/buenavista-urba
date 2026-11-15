# Research: Catálogo de farolas

## 1. Credencial de la app: SAS de servicio por tabla (opción A)

- **Decision**: `listServiceSas()` en Bicep, uno por tabla, con `canonicalizedResource: '/table/<cuenta>/<tabla en minúsculas>'`, HTTPS, caducidad de un año (mismo parámetro `sasExpiry` y `sasKey` que hoy). `Farolas`: `r`. `Auditoria`: `ra`. Cada uno en su app setting (`FAROLAS_CONNECTION`, `AUDITORIA_CONNECTION`) con el formato `TableEndpoint=…;SharedAccessSignature=…`. Se elimina `TABLES_CONNECTION`.
- **Rationale**: decisión de Rafa del 2026-11-15. Un SAS de servicio de tabla no puede crear ni borrar tablas y solo actúa sobre su tabla; con `ra`, la app no puede actualizar ni borrar entradas de auditoría. Además desaparece la diferencia entre Azure y Azurite con `srt` (solo afecta a SAS de cuenta), que impedía probar la consulta de entidades en la CI.
- **Detalle**: un SAS de servicio de tabla necesita el parámetro `tn=<tabla>` en la query. Si el token que devuelve `listServiceSas` no lo trae, el Bicep lo añade (`contains(token, 'tn=') ? token : '${token}&tn=<tabla>'`). Se verifica en Azure tras el primer despliegue (quickstart, paso 3).
- **Alternatives considered**: B (SAS de cuenta y disciplina en el código): rechazada por Rafa, una filtración permitiría borrar la auditoría. Clave de cuenta en la app: control total, descartada. Identidad administrada: las Functions gestionadas de SWA Free no la admiten.

## 2. Cómo se ejecuta la carga

- **Decision**: script TypeScript en `api/src/scripts/cargar-farolas.ts`, lanzado por un workflow manual `cargar-farolas.yml` (`workflow_dispatch`, solo desde `main`, entorno `infra` con aprobación de Rafa, OIDC con `id-buenavista-infra`). El workflow obtiene la clave de la cuenta, genera dos SAS de servicio de 1 h (`Farolas: ra`, `Auditoria: a`), los enmascara y ejecuta el script con las mismas variables que la app.
- **Rationale**: Rafa no ejecuta nada en local y la carga es una siembra puntual, como el `HasData` de EF. Reutiliza la identidad y el entorno de infra ya aprobados; la credencial es efímera y mínima.
- **Alternatives considered**: script local de los devs (exige clave en un equipo); sembrar desde la API al primer `GET` (la app necesitaría escribir `Farolas`); `deploymentScript` de Bicep (crea un contenedor de pago y una cuenta auxiliar).

## 3. Idempotencia: solo altas

- **Decision**: la carga lista las claves existentes y, por cada farola de la semilla que falta, audita y hace `createEntity` (falla si ya existe, nunca sobrescribe). No compara ni actualiza las existentes.
- **Rationale**: la posición vigente vive en la tabla (reubicaciones del cambio 8); la semilla solo inicializa. `createEntity` protege también frente a dos cargas a la vez.
- **Alternatives considered**: sincronizar el CSV (upsert): pisaría reubicaciones. Comparar y avisar de diferencias: útil, pero no pedido; se puede añadir si hace falta.

## 4. Orden auditoría → escritura

- **Decision**: primero `auditar()`, después la escritura. Si la escritura falla tras auditar, queda una entrada de un intento; la carga lo informa y, al relanzarla, vuelve a auditar y escribir.
- **Rationale**: Table Storage no tiene transacciones entre tablas. La constitución dice "si no se puede auditar, no se escribe": auditar primero garantiza que no hay escrituras sin auditar; el coste es un posible rastro de intento, aceptable.
- **Alternatives considered**: escribir y luego auditar con compensación (borrar si falla la auditoría): deja escrituras sin auditar si falla la compensación y necesita permiso de borrado.

## 5. Clave de la entrada de auditoría

- **Decision**: `PartitionKey = AAAA-MM` (UTC), `RowKey = <ISO 8601 con ms>_<UUID v4>`; campos `actor`, `accion`, `entidad`, `clave`, `antes` y `despues` (JSON en texto o vacío), `cuando` (ISO).
- **Rationale**: partición por mes para purgar (RGPD, 3 años); `RowKey` ordenable por tiempo y única.

## 6. Caché de `GET /api/farolas`

- **Decision**: `Cache-Control: public, max-age=300` en 200; `no-store` en error.
- **Rationale**: decisión del producto (cacheable en la CDN de la SWA); 5 min acotan cuánto tarda en verse una reubicación futura.

## 7. Lista de tablas contrastada con `infra/`

- **Decision**: `TABLAS` exportado en `api/src/tablas.ts`; un test lee `infra/main.bicep`, extrae los nombres de los recursos `tableServices/tables` y los compara con `TABLAS` (mismo conjunto).
- **Rationale**: lo pide el roadmap; evita desplegar código que use una tabla que no existe.
