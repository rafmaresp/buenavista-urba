# Proyecto: Buenavista I · Incidencias

Contexto de producto para OpenSpec. Fuente: decisiones de Rafa del 2026-11-12 (`.squad/decisions/inbox/`). Las propuestas de cambio (`openspec/changes/`) MUST ser coherentes con este documento; si un cambio necesita contradecirlo, primero se actualiza aquí con el visto bueno de Rafa. La secuencia de cambios vive en [`roadmap.md`](roadmap.md).

## Propósito

Web para que los comuneros de la urbanización Buenavista I (Dos Hermanas, Sevilla) avisen de farolas fundidas sobre un mapa y para que la directiva gestione esos avisos hasta su resolución. Prioridades: que reportar cueste un toque, que no haya avisos duplicados, coste 0 y datos personales mínimos.

## Actores y roles

| Rol | Quién | Puede |
|---|---|---|
| **Comunero** | Vecino con cuenta de Google | Ver el mapa de farolas y las incidencias abiertas; crear una incidencia sobre una farola (con un comentario opcional); votar +1 en una incidencia abierta |
| **Directiva** | Comunero que está en la lista de la directiva | Todo lo del comunero, más: ver todas las incidencias, cambiar su estado, ver la precisión de las farolas y reubicarlas |
| **Devs** | Equipo técnico (fuera de la app) | Cargar altas y bajas de farolas a petición de Rafa; consultar la auditoría |

- **Login con Google para todos**: Google Identity Services en Angular; el ID token se valida en **cada** Function con `google-auth-library`. Sin auth de SWA (es de pago en Standard). Coste 0 €.
- La pertenencia a la directiva se determina por una lista de emails (mecanismo pendiente, ver "Pendiente").
- El rol se decide siempre en el servidor; el front solo oculta o muestra controles.

## Funcionalidades de la v1 y reglas de negocio

### 1. Mapa de farolas
- Mapa Leaflet con capas base Ortofoto PNOA (IGN, por defecto) y Callejero OSM, con su atribución. Nada de Google Maps.
- Una marca por farola (70, `F01`–`F70`). Al tocarla: identificador, calle e incidencia abierta si la hay.
- **El comunero no ve la precisión** de la posición (verificada / estimada / inferida): es un dato interno. La API no la envía a quien no sea de la directiva.

### 2. Reportar incidencia de farola
- Solo se reporta sobre **elementos habilitados** (en v1, farolas del catálogo), nunca sobre un punto libre del mapa.
- Requiere login. Datos: farola, comentario opcional (texto corto, solo al crear), autor y fecha.
- **Duplicados**: una farola con una incidencia abierta (Nuevo o En curso) muestra esa incidencia y **no admite otra**. La garantía es del servidor (escritura condicional), no del front.
- Cuando la incidencia pasa a Completado, la farola vuelve a admitir incidencias nuevas.

### 3. Voto +1 ("a mí también")
- El comunero puede votar +1 en una incidencia abierta para darle prioridad.
- **Un voto por usuario e incidencia** (idempotente: votar dos veces no suma dos).
- No se puede votar una incidencia Completada.

### 4. Ver incidencias
- El comunero ve las incidencias **abiertas** (en el mapa y en una lista) con su farola, estado, fecha y número de votos. No ve quién las creó ni quién votó.
- **Sin hilo de comentarios**: el único comentario es el de creación.

### 5. Gestión (directiva)
- Panel con todas las incidencias, filtrable por estado y ordenable por votos y antigüedad.
- Solo la directiva cambia el estado: **Nuevo → En curso → Completado** (también Nuevo → Completado). *Propuesta a confirmar*: no se reabre una Completada; si la farola vuelve a fallar, se crea una incidencia nueva.

### 6. Reubicar farola (directiva)
- La directiva ve la precisión de cada farola y puede mover su posición desde la app; la nueva posición puede marcarse como verificada (*propuesta a confirmar*).
- **No hay historial de posiciones en la app**: el histórico queda solo en la auditoría.
- La directiva **no** da de alta ni de baja farolas ni edita nombres de calle.

### 7. Avisos por correo
- A la **directiva**, al crearse una incidencia.
- Al **comunero autor**, cuando cambia el estado de su incidencia.
- Un fallo de envío no deshace ni bloquea la operación; se registra y se reintenta o se descarta (detalle en el cambio de correo).

### 8. Auditoría de todo
- Toda escritura (incidencias, votos, estados, posiciones de farola, cargas de datos de los devs) genera una entrada de auditoría: **quién, qué, cuándo, valor anterior y valor nuevo**.
- La auditoría es de solo añadir (append-only) y se escribe en la misma operación que el cambio; si no se puede auditar, el cambio no se hace.
- En v1 la auditoría no se consulta desde la app; la consultan los devs.

## Detrás de feature flag (v1)

- **Baches**: reportar baches sobre las calles (tramos habilitados). Se desarrolla en v1 pero se despliega **apagado**; Rafa decide cuándo activarlo. Sus reglas (cómo se ubica un bache sobre un tramo, duplicados por cercanía) se concretan en su propio cambio.

## v2 / futuro

- Zonas de **maleza** (solo dentro de zonas marcadas).
- **Incidencia libre** sobre las calles.
- **Capa de redes** (solo directiva).
- **Fotos** en las incidencias (Blob Storage).

## Fuera de alcance (explícito)

- **WhatsApp en cualquier forma**: ni API ni enlaces `wa.me`.
- Que el comunero vea la precisión de las farolas.
- Hilo de comentarios o respuestas en una incidencia.
- Historial de posiciones de farola visible en la app.
- Alta o baja de farolas y edición de calles desde la app.
- Reportar en un punto libre del mapa.

## Datos de referencia

- **Farolas**: la posición vigente vive en **Table Storage**; `data/farolas_buenavista.csv` es la **semilla** (carga inicial idempotente). Inventario: 70 farolas `F01`–`F70` sin huecos.
- **F62**: existe pero no tiene coordenadas en ninguna fuente. Se siembra **inferida** en el punto medio entre F61 y F63 (37.3154785, −5.9617603, calle "C. H / C. Q (por confirmar)", precisión `inferida`, ±20 m), según la decisión del 2026-11-12. Afinar en campo no bloquea.
- **Altas y bajas**: Rafa las pide y las cargan los devs (fila en el CSV + carga), con su entrada de auditoría.
- **Calles**: no editables.
- **Reubicar**: solo la directiva, auditado.
- El front obtiene las farolas de `GET /api/farolas` (no de un JSON estático), porque la directiva puede cambiar posiciones.

## Restricciones

- **Coste 0–1 €/mes**. Cualquier recurso de pago, aunque sea por uso y cueste céntimos (cuenta de Storage, Azure Communication Services, Application Insights…), se consulta con Rafa **antes** de crearlo.
- **RGPD con datos mínimos**: de cada usuario se guarda lo imprescindible (identificador de Google `sub` y email para avisos); sin cookies de rastreo ni analítica. El comentario libre puede contener datos personales: se avisa en el formulario.
- **Stack cerrado** (no se reabre): Angular + Leaflet (PNOA + OSM) · Azure Functions Node 22 + TypeScript con `@azure/data-tables` y `google-auth-library` (sin .NET) · Table Storage (+ Blob para fotos en el futuro) · Static Web Apps Free · login Google Identity Services validado en la Function.
- **Proceso**: OpenSpec (proponer → revisión de Rafa → aplicar → archivar), un PR por cambio, Rafa revisa y fusiona.

## Pendiente

1. **Seudonimización en la auditoría (para Rai)**: el derecho de supresión choca con una auditoría append-only que guarda emails. Propuesta a evaluar: la auditoría guarda un seudónimo estable (p. ej. HMAC del `sub` con una clave secreta) y la tabla de usuarios hace de única correspondencia seudónimo ↔ email; suprimir a un usuario = borrar su fila. Falta también fijar el plazo de conservación. **Bloquea el cambio de login** (primer actor personal en la auditoría).
2. **Lista de la directiva**: cómo se mantiene. Opciones: (a) app setting `DIRECTIVA_EMAILS` en la SWA (simple, 0 €; cada cambio lo hace un dev en el portal y no queda auditado salvo que se registre aparte); (b) tabla en Storage cargada por los devs como las farolas (auditado, mismo flujo que altas y bajas); (c) gestión desde la app por la propia directiva (más alcance y más riesgo). **Bloquea el cambio de login.**
3. **Proveedor de correo con coste 0** (no decidido):

   | Opción | Coste | A favor | En contra |
   |---|---|---|---|
   | Azure Communication Services Email | Pago por uso (céntimos al mes con este volumen) | Mismo proveedor que el resto; sin cuentas de terceros | Es un **recurso de pago** (requiere consulta); con el dominio gestionado por Azure el remitente es `DoNotReply@…azurecomm.net` y los límites son bajos; dominio propio exige DNS |
   | Brevo (capa gratuita) | 0 € (≈300 correos/día) | Empresa de la UE, DPA estándar; API HTTP sencilla | Cuenta de terceros; marca en el pie en el plan gratuito; verificar remitente |
   | Mailjet (capa gratuita) | 0 € (≈200/día, 6.000/mes) | Empresa de la UE; API HTTP | Mismos inconvenientes de cuenta externa; límites diarios bajos |
   | Resend (capa gratuita) | 0 € (≈100/día, 3.000/mes) | API muy simple | Empresa de EE. UU. (transferencia internacional en el RGPD); exige dominio verificado |
   | SMTP de una cuenta Gmail de la comunidad | 0 € | Sin proveedor nuevo | Credencial de una cuenta personal o compartida en la app; límites y reglas de Google para envío automatizado; poco robusto |

   Los límites de las capas gratuitas cambian: hay que verificarlos al decidir. **Bloquea el cambio de correo.**
4. **Coordenadas reales de F62**: de momento inferidas (punto medio F61–F63, ±20 m). Rafa las toma en campo; corregirlas es una carga de datos de los devs (o una reubicación de la directiva).
5. **¿Cualquier cuenta de Google es comunero?** Hoy sí: cualquiera que inicie sesión puede reportar y votar. Alternativa: lista de comuneros o código de la comunidad. Afecta a abuso y a RGPD. Decidir antes del cambio de reportar.
6. **¿El mapa es público sin login?** Propuesta: farolas visibles sin login (no son datos personales); incidencias y votos solo con login. Decidir antes del cambio de mapa.
7. **Cuenta de Storage**: Table Storage requiere una cuenta de Storage (pago por uso, céntimos al mes). Necesita la aprobación de Rafa **antes del cambio de catálogo**.
