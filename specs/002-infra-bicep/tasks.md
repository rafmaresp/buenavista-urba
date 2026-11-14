# Tasks — infra-bicep

Dueños sugeridos: **Emilio** (Bicep, workflows), **Marisa** (verificación), **Rai** (revisión RGPD/seguridad), **Cuesta** (revisión).

## 0. Pasos únicos de Rafa (antes del primer deploy)

- [ ] 0.1 Elegir la suscripción y registrar los proveedores `Microsoft.DocumentDB`, `Microsoft.Web`, `Microsoft.Logic`, `Microsoft.Insights`, `Microsoft.CostManagement`, `Microsoft.ManagedIdentity`
- [ ] 0.2 Crear el grupo `rg-buenavista-incidencias` en `westeurope`
- [ ] 0.3 Crear las identidades `id-buenavista-infra` e `id-buenavista-app` en ese grupo, con credencial federada para `repo:<owner>/buenavista-urba:environment:infra` y `...:environment:produccion`
- [ ] 0.4 Roles de `id-buenavista-infra`: `Contributor` y `Role Based Access Control Administrator` (condición: solo `Cosmos DB Operator` y `Contributor`) en el grupo; `Reader` en la suscripción
- [ ] 0.5 GitHub: entornos `infra` (revisor obligatorio: Rafa) y `produccion` (solo rama `main`); variables `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_CLIENT_ID_INFRA`, `AZURE_CLIENT_ID_APP`; secreto de entorno `AVISOS_EMAIL`
- [ ] 0.6 Tras el primer deploy: borrar el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN` si existía

## 1. Preparación

- [ ] 1.1 Rama `feat/infra-bicep` desde `main` con `scaffold-plataforma` ya fusionado (Emilio)
- [ ] 1.2 `quality.config.json`: que el spec gate vigile `infra/` (Emilio)

## 2. Bicep (`infra/`)

- [ ] 2.1 `main.bicep` + `main.bicepparam`: SWA Free sin staging, app settings `COSMOS_CONNECTION` (con `listConnectionStrings()`) y `COSMOS_DATABASE`, sin outputs secretos (Emilio)
- [ ] 2.2 Cuenta Cosmos DB for NoSQL (sin `capabilities`) con las propiedades de `design.md` (nivel gratuito, tope 1000, una región, backup periódico por defecto, sin analítico, TLS 1.2, `disableKeyBasedMetadataWriteAccess`, `ipRules` 0.0.0.0 + `ipsDevs`) y base de datos `buenavista` con `options.throughput: 1000` compartidas, sin contenedores (Emilio)
- [ ] 2.3 Logic App de consumo + rol `Cosmos DB Operator`, grupo de acciones, presupuesto de 1 € con 4 notificaciones (corte solo en `Actual` 100) (Emilio)
- [ ] 2.4 **Verificar** que las Functions gestionadas de la SWA conectan con `ipRules` 0.0.0.0; si no, quitar la regla y anotarlo en `design.md` (Marisa)
- [ ] 2.5 **Verificar** que `Cosmos DB Operator` basta para el `PATCH` de `publicNetworkAccess` y la tarifa vigente en euros de Logic Apps y del grupo de acciones (Marisa)
- [ ] 2.6 `bicep build` y `bicep lint` sin avisos en la CI (Emilio)

## 3. Workflows

- [ ] 3.1 `infra.yml`: OIDC, entorno `infra`, comprobación de nivel gratuito (falla si otra cuenta lo tiene), `what-if` en PR de `infra/**`, deploy en `workflow_dispatch`, permisos mínimos (`id-token: write`, `contents: read`, `pull-requests: write` solo para el comentario) (Emilio)
- [ ] 3.2 Modificar `azure-swa.yml`: token por OIDC con `id-buenavista-app`, enmascarado; solo push a `main`, nunca `pull_request`; aviso y verde si falta `AZURE_CLIENT_ID_APP` (Emilio)
- [ ] 3.3 Paso de `infra.yml` tras el deploy que comprueba con `az cosmosdb sql database throughput show` que `buenavista` tiene 1000 RU/s manuales y que ningún contenedor tiene RU/s dedicadas; falla si no (Emilio)

## 4. Pruebas del corte (en el entorno real, una vez)

- [ ] 4.1 Invocar la Logic App con un cuerpo de alerta de presupuesto de prueba → `publicNetworkAccess = Disabled`, `GET /api/health` sigue respondiendo y los datos siguen ahí (Marisa)
- [ ] 4.2 Cuerpo que no es alerta de presupuesto → no corta (Marisa)
- [ ] 4.3 Reactivar con el procedimiento de `infra/README.md` (Marisa)

## 5. Documentación y cierre

- [ ] 5.1 `infra/README.md`: pasos únicos, deploy, reactivación tras un corte, rotación de la clave (regenerar la secundaria, desplegar, regenerar la primaria) y cómo añadir un contenedor (Bicep sin `options`, deploy de infra antes que la app) (Emilio)
- [ ] 5.2 `README.md`: enlace a `infra/README.md`; quitar la creación manual de SWA y del secreto (Emilio)
- [ ] 5.3 Revisión de Rai (región UE, sin datos personales en el repo) y de Cuesta (Rai, Cuesta)
- [ ] 5.4 Tras el deploy y las pruebas del punto 4, archivar el cambio (Cuesta)
