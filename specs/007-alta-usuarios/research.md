# Research: Alta de usuarios en la lista cerrada

## R1. Dónde vive la lista de correos

- **Decision**: secreto de entorno `USUARIOS_ALTA` en `infra`, una línea `correo,rol`.
- **Rationale**: el repo es público; GitHub enmascara el valor en los logs y solo lo ven los jobs del entorno `infra`, que ya exige la aprobación de Rafa. Es la única identidad con permiso para escribir en `Usuarios` fuera de la app.
- **Alternatives considered**: variable de entorno (se ve en claro en la configuración y en los logs); fichero en el repo (público); endpoint de alta en la app (necesita la pantalla de gestión, más grande y otro rol); `az storage entity insert` a mano (sin auditoría).

## R2. Cómo llega el secreto a un workflow reutilizable

- **Decision**: declararlo en `workflow_call.secrets` (opcional) y pasarlo desde `azure-swa.yml` como `AVISOS_EMAIL`; el job usa `environment: infra`, así que el secreto del entorno prevalece sobre el que pase el llamador.
- **Rationale**: mismo patrón ya probado con `AVISOS_EMAIL`; sin `secrets: inherit`.

## R3. Permisos del SAS de la carga

- **Decision**: SAS de servicio de 1 h `rad` sobre `Usuarios` solo en el job; la app mantiene `ru`.
- **Rationale**: `a` para crear, `r` para ver qué correos existen, `d` solo para deshacer un alta cuya auditoría falla (como `Farolas rad`).

## R4. Detección de "ya existe"

- **Decision**: leer una vez los correos de la partición `usuario` (`select: email`) y comparar con los normalizados.
- **Rationale**: una consulta por despliegue; cubre usuarios de baja (su correo sigue). Un suprimido tiene correo vacío, así que volver a darlo de alta crea un uid nuevo, que es lo esperado tras una supresión.
- **Alternatives considered**: una consulta por línea (más transacciones, mismo resultado).

## R5. Validación sin filtrar correos

- **Decision**: validar todas las líneas antes de escribir; los errores dan número de línea y motivo (`sin coma`, `correo no válido`, `rol desconocido`, `repetido con la línea N`), nunca el contenido.
- **Rationale**: un error a medias dejaría altas parciales y su mensaje acabaría en el log público de Actions.

## R6. Duplicados sin escritura condicional

- **Decision**: "leer correos y luego crear", sin escritura condicional por correo.
- **Rationale**: la clave de la fila es el uid aleatorio, así que Table Storage no puede rechazar un correo repetido. Solo escribe altas el job `desplegar`, que va en el grupo de concurrencia `infra-desplegar` (de uno en uno) y es el único con un SAS que permite añadir; la app no puede crear usuarios. Si aun así apareciera un duplicado, el login responde 403 a ese correo y lo registra (spec 005), sin abrir acceso.
- **Alternatives considered**: fila candado por hash del correo (otra fila con dato derivado del correo y más código para un caso que el workflow ya impide).

## R7. Una lista mal escrita para el despliegue

- **Decision**: la carga de usuarios falla el job `desplegar` (sin escribir nada), y con él el despliegue de la app de ese push.
- **Rationale**: solo ocurre cuando cambia la infra (o al lanzarlo a mano), el aviso queda en rojo donde Rafa lo ve y se arregla editando el secreto y relanzando. Un paso que no bloquee (`continue-on-error`) dejaría el job en verde y el fallo pasaría inadvertido.
