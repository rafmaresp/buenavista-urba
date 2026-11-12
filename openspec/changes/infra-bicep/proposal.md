# Infraestructura con Bicep: SWA Free, Cosmos DB for NoSQL gratuito y corte automático de coste

Cambio 1b de [`openspec/roadmap.md`](../../roadmap.md), entre `scaffold-plataforma` (1) y `catalogo-farolas` (2). Decisiones de Rafa del 2026-11-12: ningún recurso sin presupuesto ni corte automático; datos en **Cosmos DB for NoSQL** con nivel gratuito, una base de datos con 1000 RU/s compartidas y un contenedor por entidad (sustituye a Cosmos DB for Table); facturación en euros.

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
