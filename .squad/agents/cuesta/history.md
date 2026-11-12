# Cuesta — History

## Core Context

- **Role:** Lead / Architect
- **Joined:** 2026-11-11

## Learnings

<!-- Append new learnings below -->
- 2026-11-12: Primer cambio OpenSpec (scaffold-mapa-farolas). Lección: comprobar los datos fuente antes de especificar. La F62 falta en CSV, KML y JSON pero existe en la calle, así que la validación del inventario (70 IDs, sin huecos) forma parte de la spec y la CLI openspec no está instalada (validación manual). En zsh, `$VAR:path` se interpreta como modificador: usar `${VAR}:path`.
- 2026-11-12: Definición de producto en openspec/project.md y roadmap de 10 cambios en openspec/roadmap.md; scaffold-mapa-farolas sustituido por scaffold-plataforma. Lección: escribir el contexto de producto antes que el primer cambio evita propuestas con supuestos caducados (JSON estático, precisión visible). Las reglas que invento para cerrar huecos se marcan "propuesta a confirmar". quality.config.json traía appPaths ["src/"], que dejaba el spec gate ciego para web/ y api/.

- 2026-11-12: project.md y roadmap.md actualizados (Cosmos for Table, nuevos estados, mapa público, lista cerrada, pruebas en la CI, cambios 1b, 4b y 11) y propuesta infra-bicep. Lección: comprobar en la documentación de Microsoft lo que Bicep puede declarar antes de prometerlo; la capacidad compartida de la API de Table no se puede declarar en ARM/Bicep y con 400 RU/s mínimas por tabla obliga a un plan B (tabla única). Las Functions gestionadas de la SWA no tienen identidad administrada: el acceso a datos va con clave en los app settings.