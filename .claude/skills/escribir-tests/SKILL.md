---
name: escribir-tests
description: Cómo escribir tests útiles en Buenavista I (Vitest en web/ y api/). Úsala al implementar cualquier cambio con código y al revisar los tests de un PR.
---

# Escribir tests

Un test sirve si falla cuando la funcionalidad se rompe. Escribe pocos y que cuenten.

## Qué probar primero

1. **Reglas de negocio de la spec**: cada requisito o escenario de `specs/NNN-nombre/spec.md` tiene al menos un test que lo cubre, y el nombre del test lo cita en español ("no admite una segunda incidencia abierta en la misma farola").
2. **Seguridad**, para cada Function con login: sin token → 401; token inválido o caducado → 401; `email_verified: false` → 401/403; usuario fuera de la lista o de baja → 403; comunero en acción de directiva → 403. Incluye el caso positivo.
3. **Lo que la API no debe devolver**: comprueba que la respuesta a un comunero o visitante no contiene `autor`, `uid`, email, `sub` ni precisión. Comprueba las claves del objeto, no solo que exista lo esperado.
4. **Auditoría**: cada escritura genera su entrada con actor, acción, antes y después, y la entrada no contiene email, `sub`, nombre ni el texto del comentario.
5. **Bordes**: comentario de 280 y 281 caracteres, vacío, campos de más, ids inexistentes, transición de estado no permitida, voto repetido (idempotente), escritura concurrente que debe fallar por ETag.

## Cómo

- Vitest (`npm test` en `web/` y `api/`). Las reglas de negocio van en funciones puras exportadas y se prueban sin el runtime de Functions; el trigger solo las envuelve.
- Mockea solo los bordes: la verificación del token de Google (`google-auth-library`) y el cliente de `@azure/data-tables` en unitarias. Desde el cambio 2, la integración va contra Azurite en la CI.
- Datos de prueba ficticios: `uid` aleatorios y emails `@example.com`. Nunca datos reales de comuneros.
- Cada test prepara su estado y no depende del orden de ejecución.

## Qué no hacer

- Tests que solo comprueban que algo "está definido", que el componente se crea o que un mock devuelve lo que se le dijo que devolviera.
- Snapshots de HTML o JSON grandes como única aserción.
- Ajustar la aserción al resultado actual sin entender por qué falla.
- `skip`, `only`, `todo`, timeouts inflados o bajar umbrales de cobertura para pasar a verde. Si un test falla por un motivo que no entiendes, dilo en el PR.

## Al terminar

Ejecuta build y tests en `web/` y `api/`. En el comentario o el PR di qué requisitos de la spec quedan cubiertos por qué tests y cuáles no se han podido probar (por ejemplo, los 429 de Cosmos, que el emulador no reproduce).
