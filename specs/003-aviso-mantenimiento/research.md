# Research: Aviso de mantenimiento programado

Sin `NEEDS CLARIFICATION` en el Technical Context. Las dos preguntas abiertas de la spec (unicidad y conservación) esperan respuesta de Rafa; aquí se fija el defecto propuesto.

## Decisión 1: un único aviso, clave fija
- **Decision**: una sola fila (`PartitionKey=aviso`, `RowKey=vigente`); publicar sustituye al anterior (upsert).
- **Rationale**: es lo más simple, evita decidir orden o apilado de banners y hace la operación idempotente y sin condiciones de carrera.
- **Alternatives**: varios avisos simultáneos (más UI y reglas de orden); rechazado por simplicidad hasta que Rafa lo pida.

## Decisión 2: caducidad calculada en la lectura
- **Decision**: `GET` compara la fecha del aviso con la hora actual del servidor y no devuelve nada si ha pasado. No hay tarea de limpieza.
- **Rationale**: cumple FR-002 sin temporizadores ni coste; la fila caducada queda inerte.
- **Alternatives**: Function con temporizador que borre (recurso extra); TTL en cliente (depende del reloj del visitante).

## Decisión 3: conservación de caducados
- **Decision (defecto)**: la fila caducada se sobrescribe en el siguiente aviso o se borra al quitarla; el rastro histórico es la auditoría.
- **Rationale**: no añade datos ni plazos de conservación nuevos.
- **Alternatives**: historial en tabla (más datos y UI, fuera de alcance).

## Decisión 4: lectura anónima y cacheable
- **Decision**: `GET /api/aviso` sin autenticación, con `Cache-Control: public, max-age=60`, sin autor en la respuesta.
- **Rationale**: SC-002 admite 1 min; la caché de la CDN de SWA evita lecturas a la tabla.
- **Alternatives**: sin caché (más lecturas, sin ventaja visible); incluirlo en `GET /api/farolas` (acopla dos recursos con ciclos de vida distintos).

## Decisión 5: fecha y hora
- **Decision**: se guardan como instante UTC (ISO 8601) y se muestran en Europa/Madrid; el formulario recibe hora local y la convierte.
- **Rationale**: evita ambigüedad en el cambio de hora.
- **Alternatives**: guardar texto local (ambiguo dos horas al año).

## Decisión 6: auditoría sin texto en claro
- **Decision**: la entrada guarda `{presente, longitud, fecha}` antes y después, no el texto, igual que el patrón de comentarios del roadmap.
- **Rationale**: el texto es libre y podría contener datos de terceros (Principio II).
- **Alternatives**: copiar el texto (riesgo de datos personales en un registro de 3 años).
