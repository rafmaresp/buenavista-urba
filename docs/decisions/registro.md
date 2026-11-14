# Registro de decisiones

## Active Decisions

### 2026-11-12: PR #1: cerrar sin fusionar y empezar limpio (opción B) rescatando piezas; farolas como JSON estático + GET /api/health

**By:** Cuesta
**Estado:** Recomendación pendiente de aprobación de Rafa
**References:** openspec/changes/scaffold-mapa-farolas, PR #1, Mauri, Emilio, Marisa
**Why:** Recomendación para el cambio openspec/changes/scaffold-mapa-farolas.

1) PR #1 (claude/scaffold-inicial): opción B. Cerrarlo sin fusionar con un comentario que enlace el PR nuevo, conservar la rama como referencia e implementar en una rama nueva desde main. Piezas a rescatar: data/*.csv|kml, URL WMTS de PNOA, staticwebapp.config.json, ci.yml/azure-swa.yml (adaptados) y host.json. Por qué: A (reducir el PR) obliga a borrar ~80 % del diff, reescribir historia (incluye la etapa .NET y el login) y mantener un CLAUDE.md que choca con el del squad; C (fusionar tal cual) metería en main autenticación y autorización de admin sin spec, tests ni lockfile, saltándose OpenSpec. Coste de B: copiar unos 6 ficheros.

2) Catálogo de farolas: JSON estático en web/public/datos/farolas.json, generado desde data/farolas_buenavista.csv (única fuente de verdad) y con test de sincronía. La API solo expone GET /api/health para validar la cadena SWA + Functions node:22. Trade-off: no hay Storage ni arranque en frío para un catálogo casi inmutable; en el cambio de incidencias la API tendrá que empaquetar el mismo catálogo para validar farolaId.

3) El inventario es de 70 farolas F01–F70 sin huecos. La F62 existe pero no tiene coordenadas en ninguna fuente: es prerrequisito que Rafa las aporte; no se inventan.

**Corregida en parte por:** Farolas vía GET /api/farolas desde Table Storage (CSV como semilla); la precisión solo se envía a la directiva (solo el punto 2: el catálogo deja de ser JSON estático)

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

### 2026-11-12: Definición de producto v1: roles comunero/directiva, login Google para todos, sin WhatsApp, auditoría total

**By:** Squad (coordinador, directiva de Rafa)
**What:** Definición de producto v1: roles comunero/directiva, login Google para todos, sin WhatsApp, auditoría total
**References:** cuesta, rai, openspec/changes/scaffold-mapa-farolas
**Why:** Decidido por Rafa el 2026-11-12:
- Roles: **comunero** (vecino) y **directiva** (admin). Solo la directiva cambia estados (Nuevo / En curso / Completado).
- Login con Google para todos (GIS en Angular + validación del ID token en cada Function con google-auth-library). Sin auth de SWA. Coste 0 €. La pertenencia a la directiva se determina, en principio, por una lista de emails (detalle pendiente).
- La precisión de las farolas es un dato interno: el comunero no la ve. La directiva puede reubicar farolas desde la app.
- Solo se reporta en elementos o zonas habilitados, nunca en un punto libre. v1: farolas. Baches detrás de feature flag. Más adelante: maleza (solo en zonas marcadas), incidencia libre (sobre las calles) y capa de redes (solo directiva).
- Duplicados: una farola con una incidencia abierta muestra esa incidencia y no admite otra; el comunero puede votar +1 para dar prioridad (un voto por usuario e incidencia).
- El comunero ve las incidencias abiertas; solo comenta al crear la incidencia (no hay hilo).
- Avisos por correo: a la directiva al crear la incidencia y al comunero cuando cambia el estado.
- **Sin WhatsApp** (ni API ni wa.me).
- Sin fotos de momento.
- Auditoría de todo: quién, qué, cuándo, valor anterior y nuevo. Pendiente para Rai: seudonimizar en la auditoría por el RGPD (derecho de supresión).
- Plataforma: se borran `.platform/` y el skill `platform-onboard`; se mantienen los `pc-*`.

**Corregida en parte por:** Ciclo de estados de incidencia: Nuevo → Recibido → Profesional notificado (fecha estimada opcional) → Completado; el mapa exige login; se añade Belen (diseño) (solo los estados: sustituyen a Nuevo / En curso / Completado; el resto de la definición sigue vigente)

### 2026-11-12: Datos de referencia v1: altas/bajas de farolas las hacen los devs, calles no editables, zonas en v2, historial solo en la auditoría

**By:** Squad (coordinador, directiva de Rafa)
**What:** Datos de referencia v1: altas/bajas de farolas las hacen los devs, calles no editables, zonas en v2, historial solo en la auditoría
**References:** cuesta
**Why:** Decidido por Rafa el 2026-11-12:
- Alta o baja de farolas: Rafa lo notifica y lo cargan los devs; la directiva no lo hace desde la app.
- Nombres de calles: la directiva no los edita.
- Zonas (maleza, incidencia libre): van directamente a la v2.
- Historial de posiciones de una farola: solo en la auditoría; no hay vista de historial en la app.
- La directiva sí reubica farolas desde la app (decisión anterior), así que la posición vigente vive en Table Storage (la base de datos del stack), con el CSV como carga inicial. Pendiente de que Cuesta lo confirme en el diseño (opción A: `GET /api/farolas`).

### 2026-11-12: Auditoría transversal desde el cambio 2 (catalogo-farolas): cada cambio que escribe audita en su propio PR

**By:** Cuesta
**What:** Auditoría transversal desde el cambio 2 (catalogo-farolas): cada cambio que escribe audita en su propio PR
**References:** openspec/roadmap.md, openspec/project.md, rai, emilio, marisa
**Why:** La tabla `Auditoria` y el módulo `auditar()` (quién, qué, cuándo, antes, después; append-only; si no se puede auditar, no se escribe) entran en el primer cambio que escribe datos: `catalogo-farolas`, cuya carga del CSV audita con el actor no personal `sistema:carga`. Desde ahí, cada cambio que escribe incluye su auditoría, un requisito de spec de la capacidad `auditoria` y tests de la entrada generada.
Trade-off: el cambio 2 pasa de S a M y el contrato se fija pronto; la seudonimización (Rai) solo afecta al campo actor y se resuelve antes de `login-roles` (cambio 4), primer actor personal.
Descartado: cambio de auditoría propio al final, porque los cambios 5–8 llegarían a producción sin auditar y el "antes" de esas operaciones no se puede reconstruir.
Sustituye el punto 2 de la recomendación anterior (farolas como JSON estático). Secuencia completa en openspec/roadmap.md.

### 2026-11-12: Farolas vía GET /api/farolas desde Table Storage (CSV como semilla); la precisión solo se envía a la directiva

**By:** Cuesta
**What:** Farolas vía GET /api/farolas desde Table Storage (CSV como semilla); la precisión solo se envía a la directiva
**References:** openspec/changes/scaffold-plataforma, openspec/roadmap.md, emilio, mauri
**Why:** Confirma la opción A del coordinador. La posición vigente vive en la tabla `Farolas` de Table Storage, sembrada con una carga idempotente desde data/farolas_buenavista.csv (70/70, F62 inferida en el punto medio F61–F63). El front lee `GET /api/farolas`; para anónimos y comuneros la respuesta no incluye `precision`, que solo se añade para la directiva (desde `reubicar-farola`). Altas y bajas: fila en el CSV + carga por los devs, auditada.
Trade-off: hace falta una cuenta de Storage (pago por uso, céntimos al mes, requiere aprobación de Rafa antes del cambio 2) y el mapa depende del arranque en frío de la API gestionada (segundos en la primera petición), a cambio de una única fuente de verdad editable por la directiva. Descartado el JSON estático: la directiva no podría reubicar sin redesplegar y la precisión viajaría al comunero.
El cambio scaffold-mapa-farolas se sustituye por scaffold-plataforma (solo base, sin catálogo ni mapa).

**Corregida en parte por:** Datos en Cosmos DB for Table (nivel gratuito, tope de 1000 RU/s); IaC con Bicep como cambio 1b con presupuesto y corte automático; scaffold-plataforma aprobado; PR #1 cerrado (solo la base de datos: Table Storage pasa a Cosmos DB for Table; el resto del diseño sigue vigente)

### 2026-11-12: Ciclo de estados de incidencia: Nuevo → Recibido → Profesional notificado (fecha estimada opcional) → Completado; el mapa exige login; se añade Belen (diseño)

**By:** Squad (coordinador, directiva de Rafa)
**What:** Ciclo de estados de incidencia: Nuevo → Recibido → Profesional notificado (fecha estimada opcional) → Completado; el mapa exige login; se añade Belen (diseño)
**References:** cuesta, belen, mauri, rai
**Why:** Decidido por Rafa el 2026-11-12:
- Estados de incidencia (sustituyen a Nuevo / En curso / Completado):
  1. **Nuevo**: la directiva aún no la ha revisado.
  2. **Recibido**: la directiva la ha revisado.
  3. **Profesional notificado**: se ha avisado al profesional o empresa; la directiva puede poner una **fecha estimada** de resolución.
  4. **Completado**.
  Solo la directiva cambia estados. Hay que actualizar `openspec/project.md` y los cambios 7 (gestion-estados) y 9 (avisos-correo: el comunero recibe un aviso en cada cambio de estado).
- El mapa NO se ve sin iniciar sesión: toda la app requiere login.
- Acceso restringido: Rafa pregunta por una lista cerrada de correos (pendiente de que confirme el mecanismo).
- Se añade al equipo Belen (UI/UX Designer, Sonnet); Mauri implementa y revisa la viabilidad con Leaflet.
- Correo: proveedor "lo más barato y sencillo", que se decide antes del cambio 9.
- Seudonimización y conservación de la auditoría: lo propone Rai.

**Corregida en parte por:** Corrección: el mapa es público en solo lectura; las acciones requieren login y estar en la lista cerrada; quien no esté puede solicitar acceso (solo el punto del login para ver el mapa; los estados Nuevo → Recibido → Profesional notificado → Completado siguen vigentes)

### 2026-11-12: Auditoría con uid interno aleatorio (no email ni sub); tabla Usuarios única correspondencia; plazos 30 días / 12 meses / 3 años; lista cerrada de correos

**By:** Rai
**What:** Auditoría con uid interno aleatorio (no email ni sub); tabla Usuarios única correspondencia; plazos 30 días / 12 meses / 3 años; lista cerrada de correos
**References:** openspec/project.md, openspec/roadmap.md, Cuesta, Rafa
**Why:** Recomendación de Rai (veredicto 🟡, propuesta completa en docs/rgpd/propuesta-rgpd-v1.md; a validar por un profesional).

1) La auditoría guarda un uid interno aleatorio (UUID v4), no email ni sub, y se prefiere a un HMAC del sub (sin clave que custodiar y el borrado del mapeo es total). La tabla Usuarios (PK uid: email, sub, rol, estado) es la única correspondencia y a la vez la lista cerrada. Prohibido en antes/despues: email, sub, nombre y texto del comentario (se audita solo presente/longitud), con test en el cambio 2.
2) Supresión: vaciar email y sub en Usuarios, estado suprimido, autor nulo en incidencias y votos, entrada de auditoría sin datos personales.
3) Plazos: baja de usuario 30 días hasta borrar email y sub; incidencia completada, autor y comentario 12 meses; votos 12 meses tras completar (queda el recuento); auditoría 3 años con purga por partición mensual.
4) Responsable: la comunidad de propietarios; Rafa y los devs, encargados con encargo escrito. Base jurídica 6.1.f. EIPD no necesaria (nota de umbral; reevaluar con fotos). Registro de actividades y cláusula en capa en el login antes de pulsar Google.
5) Comentario visible solo para directiva y autor (decisión pendiente de Rafa). Proveedor de correo con DPA, descartando Gmail personal.
6) El cambio 4 login-roles queda condicionado a estos puntos. Se propone un cambio nuevo retencion-y-derechos antes del primer año en producción.

### 2026-11-12: Corrección: el mapa es público en solo lectura; las acciones requieren login y estar en la lista cerrada; quien no esté puede solicitar acceso

**By:** Squad (coordinador, directiva de Rafa)
**What:** Corrección: el mapa es público en solo lectura; las acciones requieren login y estar en la lista cerrada; quien no esté puede solicitar acceso
**References:** rai, cuesta, belen
**Why:** Decidido por Rafa el 2026-11-12. Anula el punto "el mapa no se ve sin login" de la decisión anterior.
- El mapa (farolas e incidencias abiertas) se ve sin iniciar sesión.
- Cualquier acción (reportar, votar, y lo de la directiva) requiere login con Google y que el email esté en la lista cerrada (tabla Usuarios con su rol).
- Si un email no está en la lista, el usuario puede **solicitar acceso**. La solicitud guarda su email porque la envía voluntariamente; Rai debe fijar el plazo de conservación si se rechaza. Pendiente: quién aprueba las solicitudes (la directiva desde la app o los devs a petición de Rafa).
- La identidad visual no existe: Belén pregunta a Rafa.
- La comunidad tiene un correo de la directiva: es el destinatario de los avisos de nuevas incidencias y de las peticiones de derechos RGPD; falta ver si además puede ser el remitente (Gmail API).

### 2026-11-12: Datos en Cosmos DB for Table (nivel gratuito, tope de 1000 RU/s); IaC con Bicep como cambio 1b con presupuesto y corte automático; scaffold-plataforma aprobado; PR #1 cerrado

**By:** Squad (coordinador, directiva de Rafa)
**What:** Datos en Cosmos DB for Table (nivel gratuito, tope de 1000 RU/s); IaC con Bicep como cambio 1b con presupuesto y corte automático; scaffold-plataforma aprobado; PR #1 cerrado
**References:** cuesta, emilio, mauri, marisa, openspec/changes/scaffold-plataforma
**Why:** Decidido por Rafa el 2026-11-12. Sustituye a "Datos: Azure Table Storage" del stack.
- **Base de datos: Azure Cosmos DB for Table** con el nivel gratuito (`enableFreeTier: true`, que da 1000 RU/s y 25 GB para siempre) y el tope de cuenta `capacity.totalThroughputLimit = 1000`. La capacidad se comparte a nivel de cuenta entre todas las tablas. Motivo: la capacidad se cobra por lo reservado, no por petición; con el tope, un abuso provoca errores 429 (lentitud) y no factura. Se mantiene el SDK `@azure/data-tables` y Azurite en local.
- No se activan funciones de pago (multirregión, backup continuo de 30 días, almacén analítico). Antes de desplegar se comprueba que la suscripción no tenga ya otra cuenta de Cosmos con el nivel gratuito.
- **IaC con Bicep** como cambio 1b (tras scaffold-plataforma): SWA Free, Cosmos DB for Table y un presupuesto de 1 €/mes con avisos al 50 % y al 100 % (real y previsto), más una acción automática que corta el acceso a los datos al 100 % (sin borrar nada; se reactiva a mano). Despliegue desde GitHub con OIDC. Ningún recurso se crea sin presupuesto ni corte automático.
- Diseño contra el abuso: escrituras solo con login y en la lista cerrada, con límite de peticiones por usuario; `GET /api/farolas` cacheado en la CDN; datos accesibles solo desde las Functions.
- Blob Storage (fotos, v2) se decide al llegar.
- **scaffold-plataforma: APROBADO** por Rafa. Previews por PR: no aprobadas (la tarea 4.3 queda fuera).
- **PR #1: se cierra sin fusionar**; la rama `claude/scaffold-inicial` se conserva.

### 2026-11-12: web/ usa Angular 21 LTS (no 22) y desactiva inlineCritical

**By:** mauri
**What:** web/ usa Angular 21 LTS (no 22) y desactiva inlineCritical
**References:** scaffold-plataforma, emilio, marisa
**Why:** Angular CLI 22 (latest) exige Node ^22.22.3 || ^24.15; el Node local es 24.14.1, por lo que no arranca. Se usa Angular 21.2.x (LTS, Node ^20.19 || ^22.12 || >=24), que funciona en local y en CI con Node 22. Migrar a 22 cuando se actualice Node local. En producción se pone optimization.styles.inlineCritical=false y fonts.inline=false para cumplir la CSP default-src 'self' (sin estilos ni onload en línea). Tests: @angular/build:unit-test (Vitest + jsdom) con 'ng test --no-watch'.

### 2026-11-12: scaffold-plataforma: CI/despliegue/api sin previews; actions fijadas por SHA; pc-quality-gates ejecuta tests de web y api

**By:** Emilio
**What:** scaffold-plataforma: CI/despliegue/api sin previews; actions fijadas por SHA; pc-quality-gates ejecuta tests de web y api
**Why:** API: tsc rootDir=src, salida dist/functions (main dist/functions/*.js); health es funcion pura exportada (src/health.ts) y el trigger solo la envuelve. Vitest 3 con `vitest run`. host.json sin App Insights. CI y azure-swa fijan actions por SHA (setup-node v7.1.0, static-web-apps-deploy v1) como los pc-*. azure-swa no se dispara en pull_request (sin previews, decision de Rafa); output_location dist/web/browser verificado con el build de Mauri. pc-quality-gates job tests: ahora setup-node 22 + npm ci + npm test en web y api (coverage floor sigue en 0, pasa sin informe). pc-weekly-quality: lizard sobre web/src y api/src. CSP default-src 'self' verificada con Chrome headless sobre el build de Angular: la pagina renderiza (inlineCritical=false, sin estilos de componente). Si se anaden estilos de componente o Leaflet habra que ampliar style-src/img-src.

### 2026-11-12: Estrategia de pruebas: todo en la CI (Azurite desde el cambio 2, Playwright e2e con el emulador de SWA desde el 3); sin previews de PR por ahora

**By:** Squad (coordinador, directiva de Rafa)
**What:** Estrategia de pruebas: todo en la CI (Azurite desde el cambio 2, Playwright e2e con el emulador de SWA desde el 3); sin previews de PR por ahora
**References:** cuesta, marisa, emilio
**Why:** Decidido por Rafa el 2026-11-12:
- Pruebas automáticas solo en la CI de GitHub Actions (entorno efímero, 0 €), sin entornos desplegados.
- Unitarias con Vitest en cada cambio (ya en el scaffold).
- Integración de la API contra Azurite en la CI, obligatoria desde el cambio 2 (catálogo de farolas).
- E2E con Playwright contra la CLI de SWA (web y API) más Azurite en la CI, desde el cambio 3 (mapa); el cambio 5 (reportar) amplía los flujos.
- Login en e2e: necesitará un mecanismo de usuarios de prueba solo para el emulador y bloqueado en producción; lo diseña Cuesta en el cambio 4 y lo revisa Rai.
- Previews de SWA por PR: no, por ahora (URLs públicas y el login de Google no funciona en ellas).

### 2026-11-13: Desarrollo dirigido por issues con Claude Code Action; se abandona Squad (fork de Plain Concepts)

**By:** Rafa
**What:** El repo deja de desarrollarse con agentes en local y pasa a reaccionar a issues de GitHub con `anthropics/claude-code-action@v1`.
**Why:** Rafa no quiere tener el código ni los agentes en su Mac. En un flujo por issues, el equipo multiagente de Squad, su MCP, el repo map y la medición AIDLC no aportan.
- Disparadores: etiqueta `claude` en un issue o `@claude` en un comentario de issue o PR. Solo el dueño del repo puede dispararlo.
- Autenticación con la suscripción de Claude (secreto `CLAUDE_CODE_OAUTH_TOKEN`), sin API de pago.
- Claude deja commits en una rama `claude/issue-<n>-…` y un enlace para abrir el PR; el PR lo abre Rafa con un clic. Sin auto-merge: Rafa revisa todo.
- Se mantienen los workflows `pc-quality-gates` y `pc-pr-guardrails` (sin el job de AIDLC). OpenSpec se sustituye después por Spec Kit (ver decisión siguiente).
- Se retiran `.squad/`, `.mcp.json`, el agente `squad`, los workflows `squad-*`, `sync-squad-labels`, `pc-squad-labels`, `pc-metrics` y `pc-weekly-quality`. Las decisiones pasan a `docs/decisions/registro.md` y los documentos de RGPD a `docs/rgpd/`.
- Siguen sin previews de SWA por PR (decisión del 2026-11-12): la revisión se apoya en la CI.

### 2026-11-13: Ecosistema de GitHub con Claude: Spec Kit sustituye a OpenSpec; fuera pc-pr-guardrails

**By:** Rafa
**What:** "Usar todo de GitHub pero usando Claude": Spec Kit (`github/spec-kit` v1.4.0, integración Claude) sustituye a OpenSpec.
**Why:**
- `specify init --integration claude` genera `.specify/` (constitución, plantillas, scripts) y las skills `.claude/skills/speckit-*`. La constitución recoge los principios del proyecto.
- Contenido migrado: `openspec/project.md` → `docs/producto.md`, `openspec/roadmap.md` → `docs/roadmap.md`, cambios `scaffold-plataforma` y `infra-bicep` → `specs/001-scaffold-plataforma/` y `specs/002-infra-bicep/` (sin reescribir al formato de Spec Kit).
- Flujo por issue en dos fases dentro del mismo PR: spec + plan + tareas → revisión de Rafa → `@claude implementa`. Errores y mejoras pequeñas, sin spec.
- Se retira `pc-pr-guardrails` (comprobaba la convención de OpenSpec). Se mantiene `pc-quality-gates` (TruffleHog, Trivy, Semgrep, SBOM, tests): en un repo privado, el escaneo nativo de GitHub (CodeQL, secret scanning con push protection) es de pago (GitHub Code Security / Secret Protection; dato a confirmar con los precios actuales), así que no hay sustituto nativo a coste 0. Pendiente de que Rafa decida las capas nativas gratuitas (Dependabot, protección de rama, etc.).
- Claude puede crear y etiquetar issues desde el proyecto en nombre de Rafa: se crean con su cuenta (`rafmaresp`), así que el filtro de actor del workflow los deja pasar sin abrirlo a nadie más.

### 2026-11-13: Skills de criterio, revisor independiente y política de fusión (aún no activa)

**By:** Rafa
**What:** Se sustituye lo que aportaba el equipo de Squad por skills de criterio en el repo y un revisor automático; se escribe la política de fusión, pero no se activa.
**Why:** Recuperar el criterio por rol (seguridad, tests, diseño) y una revisión hecha por alguien distinto del autor, con mucho menos coste que un equipo multiagente.
- Skills en `.claude/skills/` (valen para el proyecto de Claude y para la Action): `disenar-cambio`, `escribir-tests`, `revisar-seguridad` y `revisar-pr`.
- Revisor independiente: workflow `claude-revisor.yml`, con Opus 5.5 y la suscripción de Claude, que revisa cada PR no borrador, comenta los hallazgos y deja su check en rojo mientras los haya. La implementación sigue con Sonnet 5.5 (`claude.yml`).
- Flujo ligero para funcionalidades pedidas desde el proyecto: Rafa aprueba en el chat un resumen de la spec y llega un único PR con spec, código y tests.
- Política de fusión en `AGENTS.md`: Claude fusiona solo con CI en verde, revisor sin hallazgos y sin tocar zonas sensibles (listadas en `.github/CODEOWNERS`). **No activa**: hasta que Rafa la active, él fusiona todo y sigue vigente "sin auto-merge" de la constitución.
- No se activa todavía ninguna protección de rama ni ruleset; queda propuesto en el PR. Fuera de esta decisión: subagentes con rol, Azurite/emulador, Playwright, Scorecard.

### 2026-11-13: El repo pasa a ser público para poder proteger `main`

**By:** Rafa
**What:** `rafmaresp/buenavista-urba` se hará público (pendiente de que Rafa lo confirme y lo cambie). Motivo: en un repo privado del plan Free de GitHub no hay rulesets ni protección de rama, y sin ellos la política de fusión solo depende de que el agente la cumpla.
**Why:** Coste 0 €. Con el repo público se puede exigir en `main` PR obligatorio y checks en verde, y se obtienen gratis CodeQL y secret scanning con push protection.
- Antes de publicarlo se revisó el historial: sin secretos ni datos personales en el contenido. Los metadatos de algunos commits llevan el email personal de Rafa como autor.
- La capa restringida de redes (planos de tuberías y cables) **nunca** se sube al repo.
- Ruleset propuesto en `main`: PR obligatorio sin aprobaciones, checks requeridos, sin force-push ni borrado. La aprobación de code owners no se exige mientras los PRs salgan a nombre de Rafa.

### 2026-11-14: Datos en Azure Table Storage (vuelta atrás de Cosmos DB); la Action abre el PR sola

**By:** Rafa
**What:** Los datos van en **Azure Table Storage** con `@azure/data-tables` (una tabla por entidad, declarada en Bicep). Revierte "Datos en Cosmos DB" del 2026-11-12 y vuelve a la decisión del stack del 2026-11-09. Además, el workflow `claude.yml` abre el PR de la rama de Claude, lo enlaza al issue (`Closes #n`) y se lo asigna a Rafa.
**Why:**
- Table Storage cuesta céntimos al mes con este volumen, sin la regla de una sola cuenta gratuita por suscripción ni capacidad en RU/s que gestionar, y Azurite (gratuito y ligero) sirve en local y en la CI.
- Trade-off aceptado: Table Storage **no tiene tope duro de gasto** (Cosmos con nivel gratuito sí). Se acota con el presupuesto de 1 € y corte automático (que actúa con 8–24 h de retraso), un SAS limitado a entidades de Table y el límite de peticiones de la API. Sin Cosmos desaparecen la comprobación de nivel gratuito y el límite de 25 contenedores.
- Actualizados `README.md`, `AGENTS.md`, la constitución, `docs/producto.md`, `docs/roadmap.md`, `specs/002-infra-bicep/` y las skills `escribir-tests` y `revisar-seguridad`.
- PR automático: usa un token fine-grained de Rafa (secreto `PR_TOKEN`, solo este repo, Contents read, Pull requests write e Issues write) para que el PR dispare la CI y el revisor; con `GITHUB_TOKEN` no se dispararían. El PR sale a nombre de Rafa, así que GitHub no permite pedirle revisión a él mismo: la asignación hace de aviso. Sin el secreto, el workflow deja un aviso y sigue valiendo el enlace "Create PR".

### 2026-11-14: Flujo por issues en dos pasos para funcionalidad nueva

**By:** Rafa
**What:** Un issue con `claude` se clasifica primero. Los errores, las mejoras pequeñas y la documentación se implementan directamente con su test. Una funcionalidad nueva va en dos pasos: la Action escribe solo spec, plan y tareas, deja la spec resumida en el issue y para. Implementa cuando Rafa comenta `@claude implementa` en el PR.
**Why:** Sin pausa, la Action programaba antes de que Rafa viera la spec, y una mala interpretación obligaba a tirar el PR entero.
- La aprobación se da en el PR, no en el issue: cada `@claude` en el issue crea otra rama. El workflow ya no ejecuta Claude para un `@claude` en un issue que tiene PR abierto, y deja un comentario que lleva al PR.
- En la duda entre cambio pequeño y funcionalidad nueva, se trata como funcionalidad nueva.

### 2026-11-14: Spec Kit estricto: spec, plan y tareas siempre con las skills

**By:** Rafa
**What:** La Action (y Claude desde el proyecto) genera spec, plan y tareas ejecutando las skills `speckit-specify`, `speckit-plan` y `speckit-tasks`, y la implementación con `speckit-implement` y `speckit-converge`. No se escriben a mano ni se copia el formato de las specs migradas de OpenSpec (001 y 002).
**Why:** En la prueba del issue #9, la Action escribió los tres ficheros a mano en 11 turnos: la spec se parecía a la plantilla, pero el plan y las tareas copiaron el formato de la spec 002, sin "Constitution Check" ni tareas numeradas. Trade-off aceptado: cada fase spec tarda más y gasta más cuota de la suscripción.
