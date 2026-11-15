# Research: Reportar y ver incidencias de farolas

## 1. Cómo impedir duplicados (FR-004)

- **Decision**: partición = id de farola. El alta inserta primero la fila de la incidencia (RowKey = uuid) y después la fila candado (RowKey = `abierta`, con el id de la incidencia). Insertar es condicional en Table Storage: si el candado ya existe falla con 409, el repositorio borra la fila recién creada y responde con la existente. "Abierta" = incidencia referida por el candado, así que una fila suelta (alta a medias) nunca se ve como abierta. El cambio de gestión de estados borrará el candado al completar.
- **Rationale**: cubre avisos simultáneos (SC-002) con una sola escritura condicional; el orden (incidencia, luego candado) hace que un fallo a medias nunca bloquee la farola.
- **Alternatives considered**: (a) transacción de grupo con las dos filas: era la primera opción, pero Azurite rechaza con 403 cualquier transacción firmada con un SAS de tabla (probado en este PR) y no se podría probar en la CI; (b) consultar y luego insertar: carrera entre dos avisos simultáneos; (c) ETag sobre una fila de la farola en `Farolas`: exigiría permiso de escritura en `Farolas` para la app.

## 2. Deshacer si la auditoría falla

- **Decision**: misma estrategia que `RepositorioFarolas`: escribir, auditar y, si falla, borrar primero el candado y después la incidencia. Si borrar falla, `IncidenciaSinAuditar`.
- **Consecuencia**: el SAS de `Incidencias` de la app necesita `d` además de `r` y `a` (`rad`). Sin `u` hasta el cambio de gestión de estados.
- **Nota**: Azurite no aplica como Azure las restricciones del SAS de servicio (con `rad` deja borrar la tabla), así que lo que el SAS impide no se prueba contra Azurite; los permisos los fija `tablas.test.ts` contra `infra/main.bicep`.

## 3. Auditoría del comentario

- **Decision**: `despues = { farola, estado: 'Nuevo', comentarioPresente, comentarioLongitud }`. La clave `comentario` está prohibida en `auditoria.ts`; se usan claves distintas con solo booleano y número.

## 4. Consulta pública

- **Decision**: `GET /api/incidencias` anónimo, `Cache-Control: no-store`, lee solo `PartitionKey`, `RowKey`, `estado`, `creada` e `incidencia` (del candado) (con `select`, el comentario y el autor ni se piden). Devuelve las incidencias referidas por un candado y que no están en `Completado`.
- **Rationale**: `docs/producto.md` (visitante ve las abiertas sin autor ni comentario). Sin caché para que un vecino vea su aviso al recargar; el volumen (decenas de filas) hace el coste despreciable.
- **Alternatives considered**: caché pública de 5 min como `/api/farolas`: el mapa mostraría "sin incidencia" tras avisar y provocaría avisos repetidos que la API rechazaría.

## 5. Respuesta al duplicado

- **Decision**: `409 { error: 'ya-abierta', incidencia }` con la existente (leída tras el 409: candado → fila). La web la pinta como si la hubiera creado.

## 6. Web

- **Decision**: la ficha sigue construyéndose con DOM y `textContent` (sin HTML interpolado). El componente recibe un segundo cargador para las incidencias y usa `Sesion` para saber si mostrar el formulario y para el POST con `X-Id-Token`. Si fallan las incidencias, el mapa sigue y muestra un aviso.

## 7. Usuarios de prueba en el e2e

- **Decision**: fuera de este cambio. El e2e prueba la vista sin sesión (incidencias simuladas) y que `POST` sin identidad da 401 contra la API real; el alta con identidad la cubren las unitarias y la integración contra Azurite. Los usuarios de prueba bloqueados en producción necesitan un diseño revisado por Rai.
