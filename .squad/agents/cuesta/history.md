# Cuesta — History

## Core Context

- **Role:** Lead / Architect
- **Joined:** 2026-11-11

## Learnings

<!-- Append new learnings below -->
- 2026-11-12: Primer cambio OpenSpec (scaffold-mapa-farolas). Lección: comprobar los datos fuente antes de especificar. La F62 falta en CSV, KML y JSON pero existe en la calle, así que la validación del inventario (70 IDs, sin huecos) forma parte de la spec y la CLI openspec no está instalada (validación manual). En zsh, `$VAR:path` se interpreta como modificador: usar `${VAR}:path`.
- 2026-11-12: Definición de producto en openspec/project.md y roadmap de 10 cambios en openspec/roadmap.md; scaffold-mapa-farolas sustituido por scaffold-plataforma. Lección: escribir el contexto de producto antes que el primer cambio evita propuestas con supuestos caducados (JSON estático, precisión visible). Las reglas que invento para cerrar huecos se marcan "propuesta a confirmar". quality.config.json traía appPaths ["src/"], que dejaba el spec gate ciego para web/ y api/.
