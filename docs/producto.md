# Proyecto: Buenavista I · Incidencias

Contexto de producto para las specs de Spec Kit (`specs/`). Fuente: decisiones de Rafa del 2026-11-12 (`docs/decisions/registro.md`) y la propuesta RGPD de Rai (`docs/rgpd/propuesta-rgpd-v1.md`). Las specs (`specs/NNN-nombre/`) MUST ser coherentes con este documento; si un cambio necesita contradecirlo, primero se actualiza aquí con el visto bueno de Rafa. La secuencia de cambios vive en [`roadmap.md`](roadmap.md).

## Propósito

Web para que los comuneros de la urbanización Buenavista I (Dos Hermanas, Sevilla) avisen de farolas fundidas sobre un mapa y para que la directiva gestione esos avisos hasta su resolución. Prioridades: que reportar cueste un toque, que no haya avisos duplicados, coste 0 y datos personales mínimos.

## Actores y roles

| Rol | Quién | Puede |
|---|---|---|
| **Visitante** | Cualquiera, sin iniciar sesión | Ver el mapa de farolas y las incidencias abiertas (farola, estado, fecha, votos; sin autor ni comentario). Nada más |
| **Comunero** | Email en la lista cerrada con rol comunero | Lo del visitante, más: crear una incidencia sobre una farola (comentario opcional) y votar +1 en una incidencia abierta |
| **Directiva** | Email en la lista cerrada con rol directiva | Lo del comunero, más: ver todas las incidencias, cambiar su estado, ver la precisión de las farolas, reubicarlas y crear farolas nuevas |
| **Devs** | Equipo técnico (fuera de la app) | Cargar farolas y la lista cerrada a petición de Rafa; consultar la auditoría; atender supresiones |

- **Mapa público en solo lectura**; **toda acción requiere login con Google y estar en la lista cerrada**.
- **Login con Google**: Google Identity Services en Angular, cargado solo en la pantalla de login; el ID token se valida en **cada** Function con `google-auth-library` y se exige `email_verified`. Sin auth de SWA. Coste 0 €.
- **Lista cerrada = tabla `Usuarios`** (PK `uid` UUID v4 aleatorio; `email` normalizado, `sub` fijado en el primer login, `rol`, `estado` activo/baja/suprimido). Es la única correspondencia uid ↔ persona. La mantienen los devs; el rol directiva solo se cambia a petición documentada del presidente; todo auditado. El `estado` se comprueba en cada petición.
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

### 5. Reubicar y crear farola (directiva)
- Reubicar (`PUT /api/farolas/{id}`): mueve la posición y fija su precisión. Sin historial en la app (solo en la auditoría).
- Crear (`POST /api/farolas`): da de alta una farola nueva (decisión de Rafa del 2026-11-15). La directiva **no** da de baja farolas ni edita calles.

### 6. Avisos por correo
- Al **correo de la directiva** (buzón de la comunidad) al crearse una incidencia.
- Al **comunero autor** en **cada cambio de estado** de su incidencia (no a usuarios de baja).
- Contenido mínimo: farola, estado, enlace; sin comentario. El email se lee de `Usuarios` al enviar y no se copia a colas, incidencias ni auditoría. Un fallo de envío no bloquea la operación.

### 7. Auditoría de todo
- Toda escritura genera una entrada: quién, qué, cuándo, antes y después. Append-only y como efecto de la propia escritura: la hace el repositorio de cada tabla, y si la auditoría falla el cambio se deshace.
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
- Precisión de farolas visible para quien no sea directiva; hilo de comentarios; historial de posiciones en la app; baja de farolas y edición de calles desde la app; reportar en un punto libre.
- Previews de PR en la SWA.

## Datos de referencia

- **Farolas**: la posición vigente vive en la tabla `Farolas`; `data/farolas_buenavista.csv` es la **semilla**. La carga (dentro del despliegue de infraestructura) es como la siembra de una migración: solo da de alta las que faltan, nunca toca una existente y se puede relanzar sin efectos. Inventario: 70 farolas `F01`–`F70` sin huecos.
- **F62**: una farola más en los datos (`estimada`, calle "C. H / C. Q"). Nota: ninguna fuente tenía sus coordenadas y se tomó el punto medio F61–F63 (37.3154785, −5.9617603), con un error real de hasta ±20 m.
- **Altas y bajas**: altas con `POST /api/farolas` (directiva, cambio 8) o en la semilla; bajas, a petición de Rafa por los devs, auditadas. **Calles**: no editables.

## Estrategia de pruebas

Todas las pruebas corren en la CI; **sin previews de PR** por ahora.
- **Unitarias** con Vitest en cada cambio (`web/` y `api/`).
- **Integración de la API** contra **Azurite** (emulador oficial de Azure Storage, imagen Docker `mcr.microsoft.com/azure-storage/azurite`) en el job `api` de la CI (ya montado); en local, el mismo Azurite. Docker solo para pruebas, nunca en producción.
- **e2e** con Playwright contra la CLI de SWA (`swa start`), en el job `e2e` de la CI (ya montado, con una prueba de humo); cada funcionalidad con interfaz añade la suya y el cambio 5 los amplía al flujo de reportar. Capturas e informe como artefacto de la ejecución.
- **Coste de la CI: 0 €** (dentro de los minutos gratuitos de GitHub Actions; Azurite es gratuito y arranca en segundos). Azurite no reproduce límites de transacciones ni latencias reales: eso se observa en Azure.
- **Usuarios de prueba** para el e2e: solo en Azurite y **bloqueados en producción**; se diseñan en el cambio 4 y los revisa Rai.

## Restricciones

- **Coste 0–1 €/mes** (la facturación de Azure es en euros). Ningún recurso de Azure se crea sin el presupuesto de 1 €/mes y el corte automático del cambio `infra-bicep`. Cualquier recurso de pago, aunque cueste céntimos, se consulta con Rafa antes.
- **Infraestructura como código** con Bicep, desplegada desde GitHub con OIDC (sin secretos de larga duración en el repo).
- **Stack cerrado**: Angular + Leaflet (PNOA + OSM) · Azure Functions Node 22 + TypeScript (gestionadas por la SWA) con `@azure/data-tables` y `google-auth-library` · **Azure Table Storage** (cuenta de Storage `StorageV2` LRS, pago por uso: céntimos al mes con este volumen; una tabla por entidad, declarada en Bicep); Azurite (Docker) en local y en la CI · Static Web Apps Free · región UE.
- Sin funciones de pago en Storage (GRS, endpoints privados, Defender). Table Storage no tiene tope duro de gasto: lo acota el presupuesto con corte automático y el límite de peticiones por usuario.
- **Contra el abuso**: escrituras solo con login y lista cerrada, con límite de peticiones por usuario; datos accesibles solo desde las Functions. Un abuso factura por transacción (≈ 0,0004 € por 10 000, a verificar), así que 1 € equivale a millones de peticiones antes de que el corte actúe.
- **Proceso**: Spec Kit desde issues (spec, plan y tareas → revisión de Rafa → implementación en el mismo PR), un PR por feature, Rafa revisa y fusiona.

## Pendiente

1. **Solicitudes de acceso**: ¿quién las aprueba, la directiva desde la app o los devs a petición de Rafa? Rai fija el plazo de conservación de las rechazadas. **Bloquea el cambio 4b.**
2. **Preguntas RGPD de Rai para Rafa** (bloquean el cambio 4): quién firma como responsable y el encargo a Rafa y los devs; origen de la lista y si entran inquilinos; plazos 30 días / 12 meses / 3 años; visibilidad del comentario; qué ve la directiva del autor. Lo marcado VALIDAR, a revisar por un profesional.
3. **Proveedor de correo** (lo más barato y sencillo, con DPA; Rai descarta Gmail personal). Destinatario: el correo de la directiva. Falta ver si ese buzón puede ser también el remitente (Gmail API) y si eso cumple el criterio de DPA. Opciones: ACS Email (de pago por uso, consultar), Brevo o Mailjet (UE, capa gratuita), Resend (EE. UU.). **Bloquea el cambio 9.**
4. **Coordenadas reales de F62**: las toma Rafa en campo; se corrigen con una reubicación (cambio 8), porque la carga no modifica farolas existentes.
