# Research: Cambiar el estado de una incidencia

## 1. Cómo liberar la farola al completar

- **Decision**: al pasar a `Completado` se borra la fila candado `abierta` (con su ETag), después de actualizar el estado.
- **Rationale**: el alta (spec 006) inserta el candado de forma condicional; si siguiera ahí, la farola nunca volvería a admitir avisos. Borrarlo deja `crear()` intacto.
- **Alternatives considered**: (a) dejar el candado y que `crear()` lo sustituya si apunta a una Completada: complica el alta y su condición de carrera; (b) mover las completadas a otra tabla: tabla nueva sin necesidad.

## 2. Cambios simultáneos

- **Decision**: leer la fila con su ETag y actualizar con `updateEntity(..., 'Merge', { etag })`. Un 412 se traduce en `409 ha-cambiado` con el estado actual.
- **Rationale**: es la concurrencia optimista nativa de Table Storage; sin bloqueos ni filas extra.
- **Alternatives considered**: último que escribe gana: una directiva podría deshacer sin saberlo el Completado de otra.

## 3. Orden escribir → auditar → deshacer

- **Decision**: igual que el alta: actualizar estado, borrar candado (si completa), auditar. Si la auditoría falla: recrear el candado (si se borró) y devolver el estado anterior con el ETag nuevo. Si deshacer falla, `IncidenciaSinAuditar` (ya existe).
- **Rationale**: decisión del 2026-11-15 (la auditoría es efecto del repositorio) y constitución III.
- **Alternatives considered**: auditar antes de escribir: dejaría entradas de cambios que no ocurrieron si falla la escritura.
- **Riesgo aceptado**: si entre borrar el candado y recrearlo alguien avisa de la misma farola, recrearlo da 409 y se lanza `IncidenciaSinAuditar` para revisarlo a mano. La ventana son milisegundos.

## 4. Transiciones

- **Decision**: orden fijo `Nuevo < Recibido < Profesional notificado < Completado`; se acepta cualquier estado posterior al actual. Estado igual o anterior: `409 transicion-no-valida` con la incidencia actual.
- **Rationale**: propuesta de `docs/producto.md` sección 4 ("solo hacia delante, se puede saltar estados, no se reabre una Completada"). Se señala a Rafa porque está marcada "a confirmar".
- **Alternatives considered**: transiciones libres: permitiría reabrir una Completada cuando la farola ya tiene otra incidencia abierta.

## 5. Dónde comprobar el rol

- **Decision**: en `respuestaCambiarEstado()`, tras `identificar()`: `rol !== 'directiva'` → `403 sin-acceso` (mismo cuerpo genérico).
- **Rationale**: `identificar()` ya es el único punto de identidad; el rol lo devuelve. Un helper en `identidad.ts` chocaría con el cambio paralelo de reubicar farolas; se puede extraer después si ambos lo repiten.

## 6. Permiso del SAS

- **Decision**: `rad` → `raud` (añade actualizar).
- **Rationale**: Merge necesita `u`. Sigue sin poder crear ni borrar la tabla. Es cambio de `infra/`, así que la fusión pide la aprobación del entorno `infra`.

## 7. Fecha estimada y panel

- **Decision**: fuera de este cambio. El roadmap parte el cambio 7: este PR es `cambiar-estado-incidencia`; queda `gestion-estados` (panel, filtros, orden, fecha estimada, ver y ocultar comentario).
- **Rationale**: Rafa pidió "cambiar el estado de la incidencia, un PUT".
