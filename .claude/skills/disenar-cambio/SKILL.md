---
name: disenar-cambio
description: Preguntas y comprobaciones antes de especificar o programar un cambio en Buenavista I. Úsala al recibir una petición de funcionalidad nueva, antes de speckit-specify, y cuando una petición sea ambigua.
---

# Diseñar un cambio

El objetivo es no construir lo que no era. Antes de escribir la spec o el código, resuelve esto.

## 1. Situar la petición

- ¿Qué cambio del `docs/roadmap.md` es, o es algo nuevo? ¿Sus dependencias están hechas y sus decisiones pendientes cerradas?
- ¿Choca con la constitución, `docs/producto.md` o una decisión de `docs/decisions/registro.md`? Si choca, para y pregunta.
- Tamaño estimado (S < 300 líneas de diff sin lockfiles, M 300–700, L > 700). Si sale L, propón cómo partirlo.

## 2. Preguntas que suelen faltar

Haz solo las que el texto no responda, de forma concreta y con una propuesta por defecto para cada una:

- **Quién**: ¿visitante, comunero, directiva? ¿Qué ve cada uno?
- **Reglas**: límites (uno por usuario, máximo de caracteres), si se puede deshacer o retirar, qué pasa con los estados existentes.
- **Datos**: ¿qué se guarda?, ¿hay algún dato personal nuevo?, ¿cuánto tiempo se conserva? Un dato personal nuevo exige revisar `docs/rgpd/`.
- **Auditoría**: qué entrada genera cada escritura.
- **Coste**: ¿necesita un recurso o servicio nuevo? Si cuesta algo, aunque sean céntimos, decide Rafa.
- **Fuera de alcance**: qué no se hace en este cambio.

## 3. Alternativas

Escribe dos o tres formas de resolverlo, con su trade-off en una línea, y elige la más simple que cumpla. Deja las descartadas en la sección de investigación o decisiones del `plan.md` con el motivo.

## 4. Resumen para aprobar

En el flujo ligero (ver "Flujo ligero" en `AGENTS.md`) Rafa aprueba un resumen en el chat del proyecto antes de que se escriba nada. Usa este formato, en cuatro a ocho líneas:

- **Qué**: la funcionalidad en una frase.
- **Reglas**: las decisiones de negocio tomadas.
- **Datos y permisos**: qué se guarda y quién puede hacer qué.
- **Fuera**: lo que no entra.
- **Tamaño** y si toca zonas sensibles de la política de fusión.

Lo que Rafa responda va a la spec tal cual; si cambia algo respecto a una decisión anterior, se añade al registro de decisiones en el mismo PR.
