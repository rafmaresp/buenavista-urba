# Squad Decisions

## Active Decisions

### 2026-11-12: PR #1: cerrar sin fusionar y empezar limpio (opción B) rescatando piezas; farolas como JSON estático + GET /api/health

**By:** Cuesta
**Estado:** Recomendación pendiente de aprobación de Rafa
**References:** openspec/changes/scaffold-mapa-farolas, PR #1, Mauri, Emilio, Marisa
**Why:** Recomendación para el cambio openspec/changes/scaffold-mapa-farolas.

1) PR #1 (claude/scaffold-inicial): opción B. Cerrarlo sin fusionar con un comentario que enlace el PR nuevo, conservar la rama como referencia e implementar en una rama nueva desde main. Piezas a rescatar: data/*.csv|kml, URL WMTS de PNOA, staticwebapp.config.json, ci.yml/azure-swa.yml (adaptados) y host.json. Por qué: A (reducir el PR) obliga a borrar ~80 % del diff, reescribir historia (incluye la etapa .NET y el login) y mantener un CLAUDE.md que choca con el del squad; C (fusionar tal cual) metería en main autenticación y autorización de admin sin spec, tests ni lockfile, saltándose OpenSpec. Coste de B: copiar unos 6 ficheros.

2) Catálogo de farolas: JSON estático en web/public/datos/farolas.json, generado desde data/farolas_buenavista.csv (única fuente de verdad) y con test de sincronía. La API solo expone GET /api/health para validar la cadena SWA + Functions node:22. Trade-off: no hay Storage ni arranque en frío para un catálogo casi inmutable; en el cambio de incidencias la API tendrá que empaquetar el mismo catálogo para validar farolaId.

3) El inventario es de 70 farolas F01–F70 sin huecos. La F62 existe pero no tiene coordenadas en ninguna fuente: es prerrequisito que Rafa las aporte; no se inventan.

### 2026-11-12: F62 con posición inferida y provisional: punto medio F61–F63, precisión `inferida` (±20 m), pendiente de afinar en campo

**By:** Cuesta
**What:** F62 con posición inferida y provisional: punto medio F61–F63, precisión `inferida` (±20 m), pendiente de afinar en campo
**References:** openspec/changes/scaffold-mapa-farolas, Emilio, Mauri, Marisa
**Why:** Por indicación de Rafa, la F62, que existe pero no tiene coordenadas en ninguna fuente, se infiere de sus vecinas para el cambio scaffold-mapa-farolas.

- Posición: punto medio entre F61 y F63, en 37.3154785, -5.9617603. Está a 36 m de cada una y a 18 m de F60. F61 y F63 están separadas 72,6 m en línea E–O y la mediana de separación es 41,4 m, así que cabe exactamente una farola entre ambas.
- Alternativa descartada: el cruce de las prolongaciones de C. H y C. Q/R (37.315758, -5.961375), porque queda a 10 m de F59.
- Fila añadida al CSV: `62,C. H / C. Q (por confirmar),37.3154785,-5.9617603,inferida`.
- Precisión: se añade un tercer valor al enum, `inferida`, con un radio de 20 m (aproximadamente la mitad de la separación mediana). El popup muestra "Posición aproximada, pendiente de verificar (±20 m)". Se descarta reutilizar `estimada` (±5–8 m) porque daría a entender una precisión que no se tiene.
- Con esta fila el dataset cumple 70/70 y la CI de `datos` pasa. Afinar la posición en campo es la tarea 6.4, posterior y no bloqueante.
