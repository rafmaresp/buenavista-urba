# Proyecto: Buenavista I · Incidencias

Contexto de producto para las specs de Spec Kit (`specs/`). Fuente: decisiones de Rafa del 2026-11-12 (`docs/decisions/registro.md`) y la propuesta RGPD de Rai (`docs/rgpd/propuesta-rgpd-v1.md`). Las specs (`specs/NNN-nombre/`) MUST ser coherentes con este documento; si un cambio necesita contradecirlo, primero se actualiza aquí con el visto bueno de Rafa. La secuencia de cambios vive en [`roadmap.md`](roadmap.md).

## Propósito

Web para que los comuneros de la urbanización Buenavista I (Dos Hermanas, Sevilla) avisen de farolas fundidas sobre un mapa y para que la directiva gestione esos avisos hasta su resolución. Prioridades: que reportar cueste un toque, que no haya avisos duplicados, coste 0 y datos personales mínimos.

## Actores y roles

| Rol | Quién | Puede |
|---|---|---|
| **Visitante** | Cualquiera, sin iniciar sesión | Ver el mapa de farolas y las incidencias abiertas (farola, estado, fecha, votos; sin autor ni comentario). Nada más |
| **Comunero** | Email en la lista cerrada con rol comunero | Lo del visitante, más: crear una incidencia sobre una farola (comentario opcional) y votar +1 en una incidencia abierta |
| **Directiva** | Email en la lista cerrada con rol directiva | Lo del comunero, más: ver todas las incidencias, cambiar su estado, ver la precisión de las farolas y reubicarlas |
| **Devs** | Equipo técnico (fuera de la app) | Cargar farolas y la lista cerrada a petición de Rafa; consultar la auditoría; atender supresiones |

- **Mapa público en solo lectura**; **toda acción requiere login con Google y estar en la lista cerrada**.
- **Login con Google**: Google Identity Services en Angular, cargado solo en la pantalla de login; el ID token se valida en **cada** Function con `google-auth-library` y se exige `email_verified`. Sin auth de SWA. Coste 0 €.
- **Lista cerrada = contenedor `Usuarios`** (PK `uid` UUID v4 aleatorio; `email` normalizado, `sub` fijado en el primer login, `rol`, `estado` activo/baja/suprimido). Es la única correspondencia uid ↔ persona. La mantienen los devs; el rol directiva solo se cambia a petición documentada del presidente; todo auditado. El `estado` se comprueba en cada petición.
- **No autorizado**: 403 genérico, sin guardar su email ni en logs. Puede **solicitar acceso** (envía voluntariamente su email; ver "Pendiente" 1).
- El rol se decide siempre en el servidor; el front solo oculta o muestra controles.

## Funcionalidades de la v1 y reglas de negocio

### 1. Mapa de farolas
- Mapa Leaflet con capas base Ortofoto PNOA (IGN, por defecto) y Callejero OSM, con su atribución. Nada de Google Maps. Librerías y fuentes autohospedadas.
- Una marca por farola (70, `F01`–`F70`). Al tocarla: identificador, calle e incidencia abierta si la hay.
- **La precisión de la posición es interna**: la API solo la envía a la directiva.
- `GET /api/farolas` es anónimo y cacheable en la CDN de la SWA.

### 2. Reportar incidencia de farola
- Solo sobre **elementos habilitados** (en v1, farolas del catálogo), nunca sobre un punto libre.
- Datos: farola, comentario opcional (texto plano, ≤ 280 caracteres, solo al crear, con aviso de no escribir datos de terceros), autor (`uid`) y fecha.
- **Duplicados**: una farola con una incidencia abierta (cualquier estado salvo Completado) muestra esa incidencia y **no admite otra**. Lo garantiza el servidor (escritura condicional).
- **Comentario**: visible solo para la directiva y el autor (recomendación de Rai, pendiente de Rafa). La API nunca devuelve el autor a comuneros ni visitantes.

### 3. Voto +1 ("a mí también")
- Un voto por usuario e incidencia (idempotente), solo en incidencias abiertas. La API devuelve el recuento y "has votado", nunca quién votó.

### 4. Ciclo de estados (solo la directiva)
1. **Nuevo**: la directiva aún no la ha revisado.
2. **Recibido**: la directiva la ha revisado.
3. **Profesional notificado**: se ha avisado al profesional o empresa; la directiva puede poner una **fecha estimada** de resolución (opcional).
4. **Completado**: la farola vuelve a admitir incidencias.

- Transiciones validadas en servidor. *Propuesta a confirmar*: solo hacia delante (se puede saltar estados) y no se reabre una Completada; si la farola vuelve a fallar, incidencia nueva.
- Panel de gestión: todas las incidencias, filtro por estado, orden por votos y antigüedad. La directiva puede ocultar un comentario (auditado sin copiar el texto).

### 5. Reubicar farola (directiva)
- Mueve la posición y fija su precisión. Sin historial en la app (solo en la auditoría). La directiva **no** da de alta ni de baja farolas ni edita calles.

### 6. Avisos por correo
- Al **correo de la directiva** (buzón de la comunidad) al crearse una incidencia.
- Al **comunero autor** en **cada cambio de estado** de su incidencia (no a usuarios de baja).
- Contenido mínimo: farola, estado, enlace; sin comentario. El email se lee de `Usuarios` al enviar y no se copia a colas, incidencias ni auditoría. Un fallo de envío no bloquea la operación.

### 7. Auditoría de todo
- Toda escritura genera una entrada: quién, qué, cuándo, antes y después. Append-only, en la misma operación; si no se puede auditar, no se escribe.
- `actor` = `uid`, `sistema:*` o `dev:<alias>`. **Prohibido en antes/después**: email, `sub`, nombre y texto del comentario (se audita `{presente, longitud}`), con test.
- Clave de partición = mes (`AAAA-MM`) para purgar por meses. La consultan los devs; no hay vista en la app.

### 8. RGPD (mínimos de la v1, propuesta de Rai)
- Cláusula informativa en dos capas: capa 1 en el login antes del botón de Google; capa 2 en `/privacidad`.
- Registro de actividades y nota de umbral de EIPD versionados en el repo.
- Supresión a cargo de los devs (≤ 1 mes): vaciar email y `sub`, `estado = suprimido`, autor nulo en incidencias y votos; entrada de auditoría sin datos personales.
- Logs sin email, tokens ni cuerpos. Sin cookies de rastreo ni analítica. Todos los recursos en región UE.

## Detrás de feature flag (v1)

- **Baches**: se desarrolla en v1 y se despliega **apagado**; Rafa decide cuándo activarlo. Reglas en su propio cambio.

## v2 / futuro

Zonas de **maleza**, **incidencia libre** sobre las calles, **capa de redes** (solo directiva), **fotos** (Blob Storage; se decide al llegar y se reevalúa la EIPD).

## Fuera de alcance (explícito)

- **WhatsApp en cualquier forma** (ni API ni `wa.me`).
- Precisión de farolas visible para quien no sea directiva; hilo de comentarios; historial de posiciones en la app; alta/baja de farolas y edición de calles desde la app; reportar en un punto libre.
- Previews de PR en la SWA.

## Datos de referencia

- **Farolas**: la posición vigente vive en el contenedor `Farolas`; `data/farolas_buenavista.csv` es la **semilla** (carga idempotente). Inventario: 70 farolas `F01`–`F70` sin huecos.
- **F62**: sin coordenadas en ninguna fuente; se siembra **inferida** en el punto medio F61–F63 (37.3154785, −5.9617603, calle "C. H / C. Q (por confirmar)", ±20 m).
- **Altas y bajas**: las pide Rafa y las cargan los devs, auditadas. **Calles**: no editables.

## Estrategia de pruebas

Todas las pruebas corren en la CI; **sin previews de PR** por ahora.
- **Unitarias** con Vitest en cada cambio (`web/` y `api/`).
- **Integración de la API** contra el **emulador de Cosmos DB para Linux** ([imagen Docker `vNext`](https://learn.microsoft.com/azure/cosmos-db/emulator-linux), API de NoSQL) como contenedor de servicio de GitHub Actions desde el cambio 2; en local, el mismo emulador con Docker. Sustituye a Azurite. Docker solo para pruebas, nunca en producción.
- **e2e** con Playwright contra la CLI de SWA (`swa start`) más el emulador de Cosmos desde el cambio 3; el cambio 5 los amplía al flujo de reportar.
- **Coste de la CI: 0 €** (runners de GitHub para repos públicos o dentro de los minutos gratuitos; la imagen del emulador es gratuita). Trade-off: descargar y arrancar el emulador añade tiempo a cada job (de segundos a ~1 min según la caché del runner; se mide en el cambio 2 y se espera a `:8080/ready`), frente al arranque casi instantáneo de Azurite. Limitaciones del emulador `vNext` a tener en cuenta: no aplica autenticación ni RU/s (los 429 no se prueban ahí) y aún no tiene índices espaciales ni compuestos (consultas que los necesiten se prueban en Azure).
- **Usuarios de prueba** para el e2e: solo en el emulador y **bloqueados en producción**; se diseñan en el cambio 4 y los revisa Rai.

## Restricciones

- **Coste 0–1 €/mes** (la facturación de Azure es en euros). Ningún recurso de Azure se crea sin el presupuesto de 1 €/mes y el corte automático del cambio `infra-bicep`. Cualquier recurso de pago, aunque cueste céntimos, se consulta con Rafa antes.
- **Infraestructura como código** con Bicep, desplegada desde GitHub con OIDC (sin secretos de larga duración en el repo).
- **Stack cerrado**: Angular + Leaflet (PNOA + OSM) · Azure Functions Node 22 + TypeScript (gestionadas por la SWA) con `@azure/cosmos` y `google-auth-library` · **Azure Cosmos DB for NoSQL** con nivel gratuito (`enableFreeTier`, 1000 RU/s y 25 GB), tope de cuenta `totalThroughputLimit = 1000`, **una base de datos con 1000 RU/s compartidas y un contenedor por entidad** (máximo 25, sin RU/s dedicadas, declarados en Bicep); emulador de Cosmos (Docker) en local y en la CI · Static Web Apps Free · región UE.
- Sin funciones de pago en Cosmos (multirregión, backup continuo, almacén analítico). Una sola cuenta con nivel gratuito por suscripción: se comprueba antes de desplegar.
- **Contra el abuso**: escrituras solo con login y lista cerrada, con límite de peticiones por usuario; datos accesibles solo desde las Functions; el tope de RU/s convierte un abuso en errores 429, no en factura.
- **Proceso**: Spec Kit desde issues (spec, plan y tareas → revisión de Rafa → implementación en el mismo PR), un PR por feature, Rafa revisa y fusiona.

## Pendiente

1. **Solicitudes de acceso**: ¿quién las aprueba, la directiva desde la app o los devs a petición de Rafa? Rai fija el plazo de conservación de las rechazadas. **Bloquea el cambio 4b.**
2. **Preguntas RGPD de Rai para Rafa** (bloquean el cambio 4): quién firma como responsable y el encargo a Rafa y los devs; origen de la lista y si entran inquilinos; plazos 30 días / 12 meses / 3 años; visibilidad del comentario; qué ve la directiva del autor. Lo marcado VALIDAR, a revisar por un profesional.
3. **Proveedor de correo** (lo más barato y sencillo, con DPA; Rai descarta Gmail personal). Destinatario: el correo de la directiva. Falta ver si ese buzón puede ser también el remitente (Gmail API) y si eso cumple el criterio de DPA. Opciones: ACS Email (de pago por uso, consultar), Brevo o Mailjet (UE, capa gratuita), Resend (EE. UU.). **Bloquea el cambio 9.**
4. **Coordenadas reales de F62**: las toma Rafa en campo; corregirlas es una carga de los devs o una reubicación.
