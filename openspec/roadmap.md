# Roadmap de cambios hasta la v1

Un cambio OpenSpec = un PR. Tamaños: **S** ≈ < 300 líneas de diff sin lockfiles, **M** ≈ 300–700, **L** > 700 (se parte antes de empezar). Contexto de producto en [`project.md`](project.md).

| # | Cambio | Objetivo | Alcance | Depende de | Tamaño |
|---|---|---|---|---|---|
| 1 | `scaffold-plataforma` | Base compilable, probada y desplegable a 0 € | `web/` Angular vacío (una página "en construcción"), `api/` Functions Node 22/TS con `GET /api/health`, CI (`web`, `api`), deploy a SWA Free, README y comandos de `AGENTS.md`. Sin Storage, sin Leaflet. | — | S |
| 2 | `catalogo-farolas` | Farolas en Table Storage y expuestas por API, con auditoría desde la primera escritura | Tabla `Farolas` + carga idempotente desde el CSV (F62 inferida, validación 70/70) · `GET /api/farolas` anónimo **sin precisión** · tabla `Auditoria` + módulo `auditar()` (la carga audita con actor `sistema:carga`) · Azurite en CI. | 1 · aprobación de la cuenta de Storage | M |
| 3 | `mapa-farolas` | Mapa de solo lectura | Leaflet con PNOA (defecto) y OSM, marcador por farola, popup con ID y calle, error de carga visible. Sin precisión, sin login. | 2 · decidir si el mapa es público | M |
| 4 | `login-roles` | Identidad y rol en servidor | GIS en Angular, validación del ID token en cada Function, rol comunero/directiva, tabla `Usuarios` mínima (`sub`, email), `GET /api/yo`. El actor de la auditoría pasa a ser el usuario seudonimizado. | 2 · lista de la directiva · seudonimización (Rai) | M |
| 5 | `reportar-incidencia-farola` | Crear incidencias sin duplicados | `POST /api/incidencias` (farola + comentario opcional), bloqueo de duplicados con escritura condicional, `GET` de incidencias abiertas, popup con la incidencia abierta y botón "Reportar". Auditado. | 3, 4 · ¿cualquier cuenta Google es comunero? | M |
| 6 | `votos-incidencia` | Priorizar con +1 | Voto idempotente (uno por usuario e incidencia), contador visible, sin votos en Completadas. Auditado. | 5 | S |
| 7 | `gestion-estados` | La directiva gestiona | Vista de gestión (solo directiva), filtros y orden por votos/antigüedad, transiciones Nuevo → En curso → Completado validadas en servidor. Auditado. | 5 (6 para ordenar por votos) | M |
| 8 | `reubicar-farola` | Corregir posiciones desde la app | La directiva ve la precisión (`GET /api/farolas` la incluye solo para ella), mueve una farola y fija su precisión. Auditado con antes/después. | 4, 3 | S |
| 9 | `avisos-correo` | Avisar sin abrir la app | Correo a la directiva al crear y al autor al cambiar el estado; el fallo de envío no bloquea la operación. | 5, 7 · proveedor de correo | M |
| 10 | `baches-flag` | Baches listos pero apagados | Feature flag servido por la API (apagado en producción), geometría de tramos de calle, reporte de bache sobre un tramo, duplicados por cercanía. Se partirá si sale L. | 5, 7 | M–L |

Paralelizable: 6 y 8 tras 5/4; 9 en cuanto haya proveedor. Cada cambio arranca solo cuando sus decisiones pendientes están cerradas.

## Dónde va la auditoría: transversal desde el cambio 2

La infraestructura (tabla `Auditoria`, módulo `auditar()` y su contrato quién/qué/cuándo/antes/después) entra en el **primer cambio que escribe datos**, el 2 (la carga de farolas), y desde ahí **cada cambio que escribe audita en su propio PR**, con un requisito de spec de la capacidad `auditoria` y tests que comprueban la entrada generada.

- A favor: ninguna escritura llega a producción sin auditar; el coste se reparte en cambios pequeños; el contrato se estrena con un actor no personal (`sistema:carga`) mientras Rai decide la seudonimización, que solo hace falta en el cambio 4.
- En contra: el cambio 2 crece un poco (M en vez de S) y el contrato de auditoría se fija pronto; si la seudonimización obliga a cambiarlo, se toca en el 4 (solo el campo actor).
- Descartado, cambio propio al final: los cambios 5–8 irían a producción sin auditar y habría que reconstruir el "antes" de operaciones ya hechas, cosa imposible.
