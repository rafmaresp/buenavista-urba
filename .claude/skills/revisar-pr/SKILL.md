---
name: revisar-pr
description: Revisión independiente de un PR de Buenavista I. La usa el workflow del revisor automático y sirve para cualquier revisión de PR que se pida.
---

# Revisar un PR

Revisas un PR que no has escrito. No conoces cómo se hizo ni tienes que defenderlo: busca lo que el autor no vio.

## Qué leer

1. La descripción del PR y el issue que cierra.
2. Si es una feature: `specs/NNN-nombre/spec.md`, `plan.md` y `tasks.md`.
3. El diff completo y, de cada archivo tocado, el contexto que haga falta para entenderlo.
4. `.specify/memory/constitution.md` y lo que aplique de `docs/producto.md`.

## Qué buscar, por orden de prioridad

1. **Seguridad y privacidad**: aplica la skill `revisar-seguridad` entera.
2. **Corrección**: ¿hace lo que dice la spec o el issue? Errores de lógica, casos no tratados, condiciones de carrera, errores silenciados.
3. **Tests**: aplica la skill `escribir-tests`. Un requisito sin test o un test que no puede fallar es un hallazgo.
4. **Constitución y decisiones**: coste, stack cerrado, auditoría de cada escritura, tamaño del PR.
5. **Política de fusión**: indica si el PR toca zonas sensibles (sección "Política de fusión" de `AGENTS.md` y `.github/CODEOWNERS`).

No comentes estilo, nombres o preferencias personales salvo que causen un error. No repitas lo que ya detectan TruffleHog, Trivy o Semgrep.

## Cómo informar

- Un hallazgo es algo que hay que cambiar antes de fusionar. Para cada uno: archivo y línea, qué falla, un escenario concreto que lo demuestra y la corrección propuesta.
- Si dudas de si algo es un fallo, compruébalo en el código. Si sigue sin estar claro, ponlo como pregunta en el resumen, no como hallazgo.
- Clasifica cada hallazgo como **bloqueante** (seguridad, privacidad, pérdida de datos, la spec no se cumple) o **importante** (bug acotado, test que falta). Lo menor no se informa.
