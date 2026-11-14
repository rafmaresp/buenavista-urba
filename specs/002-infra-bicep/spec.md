# Infraestructura con Bicep: SWA Free, Table Storage y corte automático de coste

> Migrado de OpenSpec (`openspec/changes/infra-bicep`) el 2026-11-13. Reescrito el 2026-11-14 para **Azure Table Storage** (decisión de Rafa del 2026-11-14, que revierte Cosmos DB for NoSQL del 2026-11-12). El formato no sigue aún la plantilla de Spec Kit.

Cambio 1b de [`docs/roadmap.md`](../../docs/roadmap.md), entre `scaffold-plataforma` (1) y `catalogo-farolas` (2). Decisiones de Rafa: ningún recurso sin presupuesto ni corte automático (2026-11-12); datos en **Azure Table Storage** con `@azure/data-tables`, una tabla por entidad (2026-11-14); facturación en euros.

## Why

El cambio 2 necesita dónde guardar datos. Crear recursos a mano en el portal no deja rastro, no se revisa en un PR y no garantiza el tope de coste. Este cambio describe toda la infraestructura en Bicep, la despliega desde GitHub sin secretos de larga duración y pone un presupuesto de 1 €/mes que, si se alcanza, corta el acceso a los datos sin borrarlos.

## What Changes

- **`infra/main.bicep`** (+ `infra/main.bicepparam` sin datos personales), desplegado en un grupo de recursos que crea Rafa:
  - **Static Web App Free** (Europa Occidental), entornos de staging desactivados (sin previews de PR), app setting `TABLES_CONNECTION` (cadena de conexión con un SAS de cuenta limitado a Table, generado en el despliegue, nunca en el repo).
  - **Cuenta de Storage** `StorageV2`, `Standard_LRS`, una región UE, TLS 1.2, solo HTTPS, sin acceso público a blobs, sin replicación entre inquilinos. Solo se usa el servicio Table.
  - **Sin tablas**: cada cambio declara en `infra/` las que necesita (`tableServices/tables`).
  - **Presupuesto** `Microsoft.Consumption/budgets` de 1 €/mes sobre el grupo de recursos: avisos al 50 % y al 100 %, real y previsto, al correo de Rafa (parámetro de despliegue).
  - **Corte automático** al 100 % real: grupo de acciones → Logic App de consumo con identidad administrada → `publicNetworkAccess = Disabled` en la cuenta de Storage. No borra datos; reactivación manual documentada.
- **`.github/workflows/infra.yml`**: OIDC, `what-if` en los PR que tocan `infra/**`, despliegue manual (`workflow_dispatch`) con aprobación de Rafa.
- **Modificado `.github/workflows/azure-swa.yml`** (del cambio 1): obtiene el token de despliegue de la SWA por OIDC en lugar del secreto `AZURE_STATIC_WEB_APPS_API_TOKEN`; solo despliega en push a `main`, **nunca en `pull_request`**.
- **`infra/README.md`**: pasos únicos de Rafa, despliegue, reactivación tras un corte, renovación del SAS, rotación de claves y cómo añadir una tabla.

## Capabilities

### New Capabilities

- `infraestructura`: recursos de Azure, tope de coste, corte automático y despliegue de la infraestructura.

### Modified Capabilities

- `plataforma`: el requisito "Despliegue en Static Web Apps Free" pasa de secreto copiado a mano a token obtenido por OIDC.

## Impact

- **Código nuevo**: `infra/main.bicep`, `infra/main.bicepparam`, `infra/README.md`, `.github/workflows/infra.yml`. **Modificado**: `.github/workflows/azure-swa.yml`, `README.md` (enlace a `infra/README.md`). Sin código de aplicación.
- **Azure**: SWA Free (0 €), cuenta de Storage de pago por uso (céntimos al mes con el volumen previsto), Logic App de consumo, grupo de acciones, presupuesto e identidades administradas (ver `plan.md`).
- **RGPD**: todo en región UE; ningún dato personal en el repo (el correo de avisos es un secreto del entorno de GitHub).
- **Coste**: ≈ 0,01 €/mes esperado (estimación); sin tope duro de transacciones, acotado por el presupuesto con corte y por el límite de peticiones de la API.

## Out of scope

Blob Storage (fotos), colas, proveedor de correo, Application Insights, previews de PR, tablas (llegan con el cambio 2 y siguientes), Azurite en la CI (se monta en el cambio 2), dominio propio, alertas de Azure Monitor distintas del presupuesto.

---

# Requisitos

> Formato: requisito + escenarios WHEN/THEN.

## Capacidad: infraestructura

### ADDED Requirements

#### Requirement: Infraestructura como código
Todos los recursos de Azure del proyecto SHALL declararse en `infra/` con Bicep y desplegarse en un único grupo de recursos en una región de la UE. El repositorio MUST NOT contener secretos, claves ni datos personales (incluido el correo de avisos).

##### Scenario: Despliegue reproducible
- **WHEN** se despliega `infra/main.bicep` dos veces seguidas con los mismos parámetros
- **THEN** el segundo `what-if` no muestra más cambios que la renovación del SAS en los app settings

##### Scenario: Sin secretos en el repositorio
- **WHEN** se revisan `infra/` y los workflows
- **THEN** no aparece ninguna clave, SAS, cadena de conexión, token ni dirección de correo

#### Requirement: Static Web App Free sin previews
La infraestructura SHALL crear una Static Web App de plan Free con los entornos de staging desactivados y con la cadena de conexión de Table Storage como app setting, obtenida durante el despliegue.

##### Scenario: App setting de datos
- **WHEN** termina el despliegue
- **THEN** la SWA tiene el app setting `TABLES_CONNECTION` y su valor no aparece en ningún output ni log del workflow

##### Scenario: Sin entornos de preview
- **WHEN** se abre un pull request
- **THEN** no se crea ningún entorno de staging en la SWA

#### Requirement: Cuenta de Storage barata y endurecida
La cuenta SHALL ser `StorageV2` con `Standard_LRS` en una sola región UE, `minimumTlsVersion: TLS1_2`, `supportsHttpsTrafficOnly: true`, `allowBlobPublicAccess: false` y `allowCrossTenantReplication: false`. La cuenta MUST NOT usar redundancia geográfica, endpoints privados, Defender for Storage ni ninguna otra función de pago fijo.

##### Scenario: Propiedades de coste
- **WHEN** se inspecciona la cuenta desplegada
- **THEN** el SKU es `Standard_LRS`, hay una sola ubicación y no hay recursos de pago fijo asociados

#### Requirement: Tablas declaradas en Bicep
Las tablas SHALL declararse en `infra/` (`Microsoft.Storage/storageAccounts/tableServices/tables`) en el cambio que las necesite. Este cambio MUST NOT crear tablas. La aplicación MUST NOT crear ni borrar tablas en producción.

##### Scenario: Crear o borrar tablas con la credencial de la app
- **WHEN** alguien usa `TABLES_CONNECTION` para crear o borrar una tabla
- **THEN** Storage rechaza la operación (el SAS no incluye el tipo de recurso contenedor)

#### Requirement: Acceso restringido a los datos
La API SHALL acceder a Table Storage con un SAS de cuenta limitado al servicio Table y a entidades (sin tablas ni servicio), con permisos de leer, añadir, actualizar, borrar entidades y consultar, solo HTTPS y con caducidad. La clave de la cuenta MUST NOT salir de Azure ni guardarse en los app settings.

##### Scenario: Credencial filtrada
- **WHEN** alguien obtiene `TABLES_CONNECTION`
- **THEN** puede leer, modificar y borrar entidades (incluso todas, que equivale a perder los datos y la auditoría) hasta que caduque o se rote la clave, pero no puede borrar tablas ni acceder a blobs, colas o ficheros

##### Scenario: Conexión desde la API
- **WHEN** una Function gestionada de la SWA lee una tabla
- **THEN** la lectura funciona

#### Requirement: Presupuesto con avisos
La infraestructura SHALL crear un presupuesto mensual de 1 € (la facturación es en euros) sobre el grupo de recursos con avisos por correo al 50 % y al 100 %, tanto de coste real como previsto. El destinatario MUST ser un parámetro seguro del despliegue.

##### Scenario: Aviso al 50 %
- **WHEN** el coste real del mes alcanza el 50 % del presupuesto
- **THEN** se envía un correo al destinatario configurado y no se corta nada

##### Scenario: Previsión al 100 %
- **WHEN** el coste previsto del mes alcanza el 100 %
- **THEN** se envía un correo y no se corta nada

#### Requirement: Corte automático sin pérdida de datos
Al alcanzar el 100 % del coste real, un mecanismo automático SHALL desactivar el acceso de red público de la cuenta de Storage. El corte MUST NOT borrar datos ni recursos, MUST ejecutarse con una identidad que no pueda leer las claves ni los datos, y la reactivación SHALL ser manual y estar documentada. El mecanismo MUST NOT tener coste en reposo.

##### Scenario: Presupuesto agotado
- **WHEN** el coste real del mes alcanza el 100 %
- **THEN** la cuenta pasa a `publicNetworkAccess: Disabled`, la API deja de acceder a los datos y las tablas conservan todas sus entidades

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
