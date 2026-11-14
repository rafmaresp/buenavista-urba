# Infraestructura con Bicep: SWA Free, Cosmos DB for NoSQL gratuito y corte automático de coste

> Migrado de OpenSpec (`openspec/changes/infra-bicep`) el 2026-11-13. Contenido sin cambios; el formato no sigue aún la plantilla de Spec Kit.

Cambio 1b de [`docs/roadmap.md`](../../docs/roadmap.md), entre `scaffold-plataforma` (1) y `catalogo-farolas` (2). Decisiones de Rafa del 2026-11-12: ningún recurso sin presupuesto ni corte automático; datos en **Cosmos DB for NoSQL** con nivel gratuito, una base de datos con 1000 RU/s compartidas y un contenedor por entidad (sustituye a Cosmos DB for Table); facturación en euros.

## Why

El cambio 2 necesita una base de datos desplegada. Crear recursos a mano en el portal no deja rastro, no se revisa en un PR y no garantiza el tope de coste. Este cambio describe toda la infraestructura en Bicep, la despliega desde GitHub sin secretos de larga duración y pone un presupuesto de 1 €/mes que, si se alcanza, corta el acceso a los datos sin borrarlos.

## What Changes

- **`infra/main.bicep`** (+ `infra/main.bicepparam` sin datos personales), desplegado en un grupo de recursos que crea Rafa:
  - **Static Web App Free** (Europa Occidental), entornos de staging desactivados (sin previews de PR), app settings `COSMOS_CONNECTION` (cadena de conexión tomada en el despliegue, nunca en el repo) y `COSMOS_DATABASE`.
  - **Cosmos DB for NoSQL**: `enableFreeTier: true`, `capacity.totalThroughputLimit: 1000`, una región UE, backup periódico por defecto, sin multirregión, sin almacén analítico, TLS 1.2, firewall "solo centros de datos de Azure", escritura de metadatos con clave desactivada.
  - **Base de datos `buenavista`** (`sqlDatabases`) con **1000 RU/s manuales compartidas** (`options.throughput: 1000`). **Sin contenedores**: cada cambio declara en `infra/` los que necesita, sin RU/s dedicadas.
  - **Presupuesto** `Microsoft.Consumption/budgets` de 1 €/mes sobre el grupo de recursos: avisos al 50 % y al 100 %, real y previsto, al correo de Rafa (parámetro de despliegue).
  - **Corte automático** al 100 % real: grupo de acciones → Logic App de consumo con identidad administrada → `publicNetworkAccess = Disabled` en la cuenta de Cosmos. No borra datos; reactivación manual documentada.
- **`.github/workflows/infra.yml`**: OIDC, comprobación previa de nivel gratuito, `what-if` en los PR que tocan `infra/**`, despliegue manual (`workflow_dispatch`) con aprobación de Rafa.
- **Modificado `.github/workflows/azure-swa.yml`** (del cambio 1): obtiene el token de despliegue de la SWA por OIDC en lugar del secreto `AZURE_STATIC_WEB_APPS_API_TOKEN`; solo despliega en push a `main`, **nunca en `pull_request`**.
- **`infra/README.md`**: pasos únicos de Rafa, despliegue, reactivación tras un corte, rotación de la clave y cómo añadir un contenedor.

## Capabilities

### New Capabilities

- `infraestructura`: recursos de Azure, tope de coste, corte automático y despliegue de la infraestructura.

### Modified Capabilities

- `plataforma`: el requisito "Despliegue en Static Web Apps Free" pasa de secreto copiado a mano a token obtenido por OIDC (requiere archivar antes `scaffold-plataforma`).

## Impact

- **Código nuevo**: `infra/main.bicep`, `infra/main.bicepparam`, `infra/README.md`, `.github/workflows/infra.yml`. **Modificado**: `.github/workflows/azure-swa.yml`, `README.md` (enlace a `infra/README.md`). Sin código de aplicación.
- **Azure**: SWA Free (0 €), Cosmos DB for NoSQL nivel gratuito (0 € dentro de 1000 RU/s y 25 GB), Logic App de consumo, grupo de acciones, presupuesto e identidades administradas (≈ 0,00 €/mes; ver `design.md`).
- **RGPD**: todo en región UE; ningún dato personal en el repo (el correo de avisos es un secreto del entorno de GitHub).
- **Coste**: 0 €/mes esperado; tope duro de RU/s y corte al alcanzar 1 €.

## Out of scope

Blob Storage, proveedor de correo, Application Insights, previews de PR, contenedores (llegan con el cambio 2 y siguientes), emulador de Cosmos en la CI (se monta en el cambio 2), dominio propio, alertas de Azure Monitor distintas del presupuesto.

---

# Requisitos

> Migrado de OpenSpec (deltas de spec por capacidad). Formato: requisito + escenarios WHEN/THEN.

## Capacidad: infraestructura

### ADDED Requirements

#### Requirement: Infraestructura como código
Todos los recursos de Azure del proyecto SHALL declararse en `infra/` con Bicep y desplegarse en un único grupo de recursos en una región de la UE. El repositorio MUST NOT contener secretos, claves ni datos personales (incluido el correo de avisos).

##### Scenario: Despliegue reproducible
- **WHEN** se despliega `infra/main.bicep` dos veces seguidas con los mismos parámetros
- **THEN** el segundo `what-if` no muestra cambios

##### Scenario: Sin secretos en el repositorio
- **WHEN** se revisan `infra/` y los workflows
- **THEN** no aparece ninguna clave, cadena de conexión, token ni dirección de correo

#### Requirement: Static Web App Free sin previews
La infraestructura SHALL crear una Static Web App de plan Free con los entornos de staging desactivados y con la cadena de conexión de Cosmos como app setting, obtenida durante el despliegue.

##### Scenario: App setting de datos
- **WHEN** termina el despliegue
- **THEN** la SWA tiene los app settings `COSMOS_CONNECTION` y `COSMOS_DATABASE` y el valor de la cadena de conexión no aparece en ningún output ni log del workflow

##### Scenario: Sin entornos de preview
- **WHEN** se abre un pull request
- **THEN** no se crea ningún entorno de staging en la SWA

#### Requirement: Cosmos DB for NoSQL gratuito y con tope
La cuenta de Cosmos DB SHALL usar la API de NoSQL, el nivel gratuito (`enableFreeTier: true`) y el tope de cuenta `totalThroughputLimit: 1000`, en una sola región UE, con backup periódico por defecto, TLS mínimo 1.2 y escritura de metadatos con clave desactivada. La cuenta MUST NOT tener multirregión, escrituras multirregión, backup continuo ni almacén analítico.

##### Scenario: Propiedades de coste
- **WHEN** se inspecciona la cuenta desplegada
- **THEN** `enableFreeTier` es `true`, `capacity.totalThroughputLimit` es `1000`, `capabilities` no incluye `EnableTable`, hay una sola ubicación y el backup es periódico

##### Scenario: Abuso de peticiones
- **WHEN** las peticiones superan 1000 RU/s
- **THEN** Cosmos responde 429 y no se factura capacidad adicional

#### Requirement: Base de datos con capacidad compartida
La infraestructura SHALL crear una base de datos `buenavista` con 1000 RU/s manuales compartidas (`options.throughput: 1000`). Los contenedores SHALL declararse en `infra/` en el cambio que los necesite, sin RU/s dedicadas, y MUST NOT superar 25 en la base de datos. Este cambio MUST NOT crear contenedores.

##### Scenario: Capacidad compartida
- **WHEN** termina el despliegue
- **THEN** la base de datos `buenavista` tiene 1000 RU/s manuales, o el workflow falla con un mensaje que lo indica

##### Scenario: Contenedor con RU/s dedicadas
- **WHEN** un cambio declara un contenedor con `options.throughput` o `options.autoscaleSettings`
- **THEN** el despliegue falla porque la cuenta supera `totalThroughputLimit`, y la comprobación posterior al deploy también lo rechaza

##### Scenario: Crear contenedores con la clave
- **WHEN** alguien intenta crear o borrar un contenedor con la clave de la cuenta
- **THEN** Cosmos rechaza la operación de metadatos

#### Requirement: Acceso restringido a los datos
La cuenta de Cosmos SHALL aceptar conexiones solo desde centros de datos de Azure, más las IP de devs pasadas explícitamente como parámetro. La clave de la cuenta MUST vivir solo en los app settings de la SWA.

##### Scenario: Conexión desde Internet doméstico
- **WHEN** alguien con la cadena de conexión intenta acceder desde una IP fuera de Azure no listada
- **THEN** Cosmos rechaza la conexión

##### Scenario: Conexión desde la API
- **WHEN** una Function gestionada de la SWA lee un contenedor
- **THEN** la lectura funciona

#### Requirement: Comprobación de nivel gratuito
Antes de cada `what-if` o despliegue, el workflow MUST comprobar que ninguna otra cuenta de Cosmos de la suscripción usa el nivel gratuito y MUST fallar sin desplegar si alguna lo usa.

##### Scenario: Otra cuenta gratuita en la suscripción
- **WHEN** existe en la suscripción otra cuenta de Cosmos con `enableFreeTier: true`
- **THEN** el workflow falla antes de desplegar y no se crea ninguna cuenta

##### Scenario: Redespliegue de la propia cuenta
- **WHEN** la única cuenta gratuita es la del proyecto
- **THEN** la comprobación pasa

#### Requirement: Presupuesto con avisos
La infraestructura SHALL crear un presupuesto mensual de 1 € (la facturación es en euros) sobre el grupo de recursos con avisos por correo al 50 % y al 100 %, tanto de coste real como previsto. El destinatario MUST ser un parámetro seguro del despliegue.

##### Scenario: Aviso al 50 %
- **WHEN** el coste real del mes alcanza el 50 % del presupuesto
- **THEN** se envía un correo al destinatario configurado y no se corta nada

##### Scenario: Previsión al 100 %
- **WHEN** el coste previsto del mes alcanza el 100 %
- **THEN** se envía un correo y no se corta nada

#### Requirement: Corte automático sin pérdida de datos
Al alcanzar el 100 % del coste real, un mecanismo automático SHALL desactivar el acceso de red público de la cuenta de Cosmos. El corte MUST NOT borrar datos ni recursos, MUST ejecutarse con una identidad que no pueda leer las claves, y la reactivación SHALL ser manual y estar documentada. El mecanismo MUST NOT tener coste en reposo.

##### Scenario: Presupuesto agotado
- **WHEN** el coste real del mes alcanza el 100 %
- **THEN** la cuenta pasa a `publicNetworkAccess: Disabled`, la API deja de acceder a los datos y los contenedores conservan todos sus documentos

##### Scenario: Invocación no válida
- **WHEN** el mecanismo de corte recibe una petición que no es una alerta de presupuesto
- **THEN** no modifica la cuenta

##### Scenario: Reactivación
- **WHEN** Rafa ejecuta el deploy manual de `infra.yml` tras revisar la causa
- **THEN** la cuenta vuelve a `publicNetworkAccess: Enabled` y la API recupera el acceso

#### Requirement: Despliegue de infraestructura con OIDC
El workflow `infra.yml` SHALL autenticarse en Azure con identidad federada (OIDC), sin secretos de larga duración, ejecutar `what-if` en los pull request que modifican `infra/**` y desplegar solo bajo ejecución manual. Ambos jobs MUST usar un entorno de GitHub con aprobación obligatoria de Rafa.

##### Scenario: PR que toca la infraestructura
- **WHEN** se abre un PR que modifica `infra/main.bicep`
- **THEN** tras la aprobación del entorno, el job publica el resultado del `what-if` y no despliega nada

##### Scenario: Fusión en main
- **WHEN** se fusiona en `main` un PR que modifica `infra/**`
- **THEN** no se despliega la infraestructura hasta que alguien lanza el workflow a mano

## Capacidad: plataforma

### MODIFIED Requirements

#### Requirement: Despliegue en Static Web Apps Free
El despliegue SHALL publicar `web/` y `api/` en una Azure Static Web App de plan Free con API gestionada (`apiRuntime: node:22`) en cada push a `main`, obteniendo el token de despliegue de la SWA en el propio workflow mediante identidad federada (OIDC). El workflow MUST NOT ejecutarse en `pull_request` ni crear entornos de preview, y MUST NOT depender de un secreto con el token copiado a mano. Si no existe la variable `AZURE_CLIENT_ID_APP`, el workflow MUST terminar sin error y con un aviso, sin desplegar.

##### Scenario: Push a main con identidad configurada
- **WHEN** se fusiona un PR en `main` y la identidad de despliegue está configurada
- **THEN** el workflow obtiene el token por OIDC sin mostrarlo en el log, despliega la web y la API, y `GET /api/health` responde `200` en la URL de la SWA

##### Scenario: Sin identidad configurada
- **WHEN** se hace push a `main` y la variable `AZURE_CLIENT_ID_APP` no existe
- **THEN** el workflow termina en verde con el aviso de despliegue omitido

##### Scenario: Pull request
- **WHEN** se abre o actualiza un pull request
- **THEN** el workflow de despliegue no se ejecuta y no se crea ningún entorno de preview

##### Scenario: Recarga en una ruta
- **WHEN** el navegador pide una ruta de la SPA que no es un fichero
- **THEN** SWA sirve `index.html`
