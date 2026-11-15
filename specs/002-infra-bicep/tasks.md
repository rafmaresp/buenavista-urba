# Tasks — infra-bicep

> Reescrito el 2026-11-14 para Table Storage.

## 0. Pasos únicos de Rafa (antes del primer deploy)

- [x] 0.1 Elegir la suscripción y registrar los proveedores `Microsoft.Storage`, `Microsoft.Web`, `Microsoft.Logic`, `Microsoft.Insights`, `Microsoft.CostManagement`, `Microsoft.ManagedIdentity`
- [x] 0.2 Crear el grupo `rg-buenavista-incidencias` en `westeurope`
- [x] 0.3 Crear las identidades `id-buenavista-infra` e `id-buenavista-app` en ese grupo, con credencial federada para `repo:<owner>/buenavista-urba:environment:infra` y `...:environment:produccion`
- [x] 0.4 Crear el rol personalizado `Buenavista corte de Storage` (solo `Microsoft.Storage/storageAccounts/read` y `/write`, asignable en el grupo) con el comando del README
- [x] 0.5 Roles de `id-buenavista-infra`: `Contributor` y `Role Based Access Control Administrator` (condición: solo el rol de corte y `Contributor`) en el grupo
- [ ] 0.6 (en curso) GitHub: entornos `infra` (revisor obligatorio: Rafa) y `produccion` (solo rama `main`); variables `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_CLIENT_ID_INFRA`, `AZURE_CLIENT_ID_APP`; secreto de entorno `AVISOS_EMAIL`
- [ ] 0.7 Tras el primer deploy: borrar el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN` si existía

## 1. Preparación

- [x] 1.1 Rama desde `main` con `scaffold-plataforma` ya fusionado

## 2. Bicep (`infra/`)

- [x] 2.1 `main.bicep` + `main.bicepparam`: SWA Free sin staging, app setting `TABLES_CONNECTION` con SAS de `listAccountSas()` (Table, entidades, `raudl`, HTTPS, caducidad parámetro a 1 año), sin outputs secretos
- [x] 2.2 Cuenta de Storage con las propiedades de `plan.md` (StorageV2, LRS, TLS 1.2, solo HTTPS, sin blobs públicos, sin replicación entre inquilinos) y `tableServices/default`, sin tablas
- [x] 2.3 Logic App de consumo + asignación del rol de corte, grupo de acciones, presupuesto de 1 € con 4 notificaciones (corte solo en `Actual` 100)
- [ ] 2.4 **Verificar** que `@azure/data-tables` conecta con la cadena `TableEndpoint=…;SharedAccessSignature=…` desde una Function gestionada y desde Azurite, y que el SAS no puede crear ni borrar tablas (Azurite: `api/src/tables.integration.test.ts`, salvo consultar entidades, que Azurite 3.35 rechaza con `srt=o` aunque Azure lo admite; Function gestionada y consulta: pendiente del primer despliegue)
- [ ] 2.5 **Verificar** que el rol de corte basta para el `PATCH` de `publicNetworkAccess` y no permite `listKeys`, las tarifas vigentes en euros de Table Storage, Logic Apps y grupo de acciones, y si Storage factura las peticiones que rechaza con `publicNetworkAccess: Disabled`
- [x] 2.6 `bicep build` y `bicep lint` sin avisos en la CI

## 3. Workflows

- [x] 3.1 `infra.yml`: OIDC, entorno `infra`, `what-if` en PR de `infra/**` (en el resumen del job, sin propiedades), deploy en `workflow_dispatch` desde `main`, permisos mínimos (`id-token: write`, `contents: read`)
- [x] 3.2 Modificar `azure-swa.yml`: token por OIDC con `id-buenavista-app`, enmascarado; solo push a `main`, nunca `pull_request`; aviso y verde si falta `AZURE_CLIENT_ID_APP`

## 4. Pruebas del corte (en el entorno real, una vez)

- [ ] 4.1 Invocar la Logic App con un cuerpo de alerta de presupuesto de prueba → `publicNetworkAccess = Disabled`, `GET /api/health` sigue respondiendo y los datos siguen ahí
- [ ] 4.2 Cuerpo que no es alerta de presupuesto → no corta
- [ ] 4.3 Reactivar con el procedimiento de `infra/README.md`

## 5. Documentación y cierre

- [x] 5.1 `infra/README.md`: pasos únicos (con el comando del rol personalizado), deploy, reactivación tras un corte, caducidad y renovación del SAS, rotación de claves (regenerar la clave que no firma, desplegar firmando con ella, regenerar la otra) y cómo añadir una tabla (Bicep, deploy de infra antes que la app)
- [x] 5.2 `README.md`: enlace a `infra/README.md`; quitar la creación manual de SWA y del secreto
- [x] 5.3 Revisión con `revisar-seguridad` (región UE, sin datos personales en el repo, alcance del SAS)
