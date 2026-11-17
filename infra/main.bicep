// Infraestructura de Buenavista I (spec 002-infra-bicep).
// Se despliega en el grupo de recursos que crea Rafa (rg-buenavista-incidencias) con infra.yml.
// Sin secretos en el repo: los SAS de datos (uno por tabla) se generan aquí y el correo de avisos llega como parámetro seguro.

targetScope = 'resourceGroup'

@description('Región UE de Storage y la Logic App. westeurope no admite recursos nuevos en esta suscripción.')
param location string = resourceGroup().location

@description('Región de la Static Web App. En la UE, el plan Free solo existe en westeurope.')
param swaLocation string = 'westeurope'

@description('Correo de los avisos del presupuesto (secreto AVISOS_EMAIL del entorno infra).')
@secure()
@minLength(3)
param avisosEmail string

@description('GUID del rol personalizado "Buenavista corte de Storage" (lo crea Rafa una vez; infra.yml lo resuelve).')
@minLength(36)
@maxLength(36)
param corteRoleId string

@description('Primer día del mes desde el que cuenta el presupuesto (AAAA-MM-01).')
param presupuestoInicio string

@description('Caducidad del SAS de datos. Cada despliegue lo renueva un año.')
param sasExpiry string = dateTimeAdd(utcNow(), 'P1Y')

@description('Clave de la cuenta que firma el SAS (key1 o key2). Se alterna al rotar claves (infra/README.md).')
@allowed([
  'key1'
  'key2'
])
param sasKey string = 'key1'

@description('Client ID del cliente OAuth de Google (público: aparece en la página de login). Vacío = login no disponible.')
param googleClientId string = ''

@description('Importe mensual del presupuesto, en la moneda de facturación (euros).')
param presupuestoImporte int = 1

var contributorRoleId = 'b24988ac-6180-42a0-ab88-20f7382dd24c'

// ---------- Storage (solo se usa Table) ----------

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take('stbuenavista${uniqueString(resourceGroup().id)}', 24)
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowCrossTenantReplication: false
    allowSharedKeyAccess: true // necesario para firmar el SAS
    publicNetworkAccess: 'Enabled' // el corte lo pone en Disabled; un deploy lo reactiva
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// Cada cambio declara aquí sus tablas (tableServices/tables); api/src/tablas.ts debe coincidir (lo comprueba un test).
resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource tablaFarolas 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'Farolas'
}

resource tablaAuditoria 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'Auditoria'
}

// Lista cerrada (spec 005-login-roles): uid, email, sub, rol, estado.
resource tablaUsuarios 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'Usuarios'
}

// Incidencias (spec 006-reportar-incidencia-farola): una partición por farola, con la fila candado
// `abierta` que impide una segunda incidencia abierta.
resource tablaIncidencias 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'Incidencias'
}

// Un SAS de servicio por tabla (decisión 2026-11-15, opción A): solo actúa sobre su tabla, no crea
// ni borra tablas, solo HTTPS y caduca al año. La app lee y actualiza Farolas (ru: reubicar, spec 008;
// ni añade ni borra) y solo añade y lee Auditoria (ra): ni un fallo ni una credencial filtrada
// pueden modificar o borrar la auditoría.
// Un SAS de tabla necesita tn=<tabla> en la query; se añade si listServiceSas no lo devuelve.
var tableEndpoint = storage.properties.primaryEndpoints.table

var farolasSasToken = storage.listServiceSas('2023-05-01', {
  canonicalizedResource: '/table/${storage.name}/${toLower(tablaFarolas.name)}'
  signedPermission: 'ru'
  signedProtocol: 'https'
  signedExpiry: sasExpiry
  keyToSign: sasKey
}).serviceSasToken
var farolasSas = contains(farolasSasToken, 'tn=') ? farolasSasToken : '${farolasSasToken}&tn=${tablaFarolas.name}'

var auditoriaSasToken = storage.listServiceSas('2023-05-01', {
  canonicalizedResource: '/table/${storage.name}/${toLower(tablaAuditoria.name)}'
  signedPermission: 'ra'
  signedProtocol: 'https'
  signedExpiry: sasExpiry
  keyToSign: sasKey
}).serviceSasToken
var auditoriaSas = contains(auditoriaSasToken, 'tn=') ? auditoriaSasToken : '${auditoriaSasToken}&tn=${tablaAuditoria.name}'

// Usuarios: la app lee, da de alta, actualiza (sub en el primer login; rol y estado por la directiva,
// spec 009) y borra solo para deshacer un alta cuya auditoría falló.
var usuariosSasToken = storage.listServiceSas('2023-05-01', {
  canonicalizedResource: '/table/${storage.name}/${toLower(tablaUsuarios.name)}'
  signedPermission: 'raud'
  signedProtocol: 'https'
  signedExpiry: sasExpiry
  keyToSign: sasKey
}).serviceSasToken
var usuariosSas = contains(usuariosSasToken, 'tn=') ? usuariosSasToken : '${usuariosSasToken}&tn=${tablaUsuarios.name}'

// Incidencias: la app lee y da de alta; borrar solo para deshacer un alta cuya auditoría falló.
// Sin actualizar hasta el cambio de gestión de estados.
var incidenciasSasToken = storage.listServiceSas('2023-05-01', {
  canonicalizedResource: '/table/${storage.name}/${toLower(tablaIncidencias.name)}'
  signedPermission: 'rad'
  signedProtocol: 'https'
  signedExpiry: sasExpiry
  keyToSign: sasKey
}).serviceSasToken
var incidenciasSas = contains(incidenciasSasToken, 'tn=') ? incidenciasSasToken : '${incidenciasSasToken}&tn=${tablaIncidencias.name}'

// ---------- Static Web App Free ----------

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: 'swa-buenavista'
  location: swaLocation
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Disabled' // sin previews de PR
    allowConfigFileUpdates: true
  }
}

// Sustituye TODOS los app settings: cualquier otro setting de la app se declara aquí.
resource swaSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: swa
  name: 'appsettings'
  properties: {
    FAROLAS_CONNECTION: 'TableEndpoint=${tableEndpoint};SharedAccessSignature=${farolasSas}'
    AUDITORIA_CONNECTION: 'TableEndpoint=${tableEndpoint};SharedAccessSignature=${auditoriaSas}'
    USUARIOS_CONNECTION: 'TableEndpoint=${tableEndpoint};SharedAccessSignature=${usuariosSas}'
    INCIDENCIAS_CONNECTION: 'TableEndpoint=${tableEndpoint};SharedAccessSignature=${incidenciasSas}'
    GOOGLE_CLIENT_ID: googleClientId
  }
}

// id-buenavista-app (entorno produccion) solo puede leer el token de despliegue de esta SWA.
resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: 'id-buenavista-app'
}

resource appSwaContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(swa.id, appIdentity.id, contributorRoleId)
  scope: swa
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', contributorRoleId)
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------- Corte automático: presupuesto → grupo de acciones → Logic App ----------

resource corte 'Microsoft.Logic/workflows@2019-05-01' = {
  name: 'logic-buenavista-corte'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    state: 'Enabled'
    definition: {
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      triggers: {
        manual: {
          type: 'Request'
          kind: 'Http'
          inputs: {
            schema: {}
          }
        }
      }
      actions: {
        // Solo actúa con una alerta de presupuesto de gasto real con el esquema común (campos de la muestra
        // oficial «Cost budget alert»: learn.microsoft.com/azure/azure-monitor/alerts/alerts-payload-samples).
        // Cualquier otra petición no corta.
        EsAlertaDePresupuesto: {
          type: 'If'
          expression: {
            and: [
              {
                equals: [
                  '@coalesce(triggerBody()?[\'schemaId\'], \'\')'
                  'azureMonitorCommonAlertSchema'
                ]
              }
              {
                equals: [
                  '@coalesce(triggerBody()?[\'data\']?[\'essentials\']?[\'monitoringService\'], \'\')'
                  'CostAlerts'
                ]
              }
              {
                equals: [
                  '@coalesce(triggerBody()?[\'data\']?[\'alertContext\']?[\'AlertCategory\'], \'\')'
                  'budgets'
                ]
              }
              {
                equals: [
                  '@coalesce(triggerBody()?[\'data\']?[\'alertContext\']?[\'AlertData\']?[\'ThresholdType\'], \'\')'
                  'Actual'
                ]
              }
            ]
          }
          actions: {
            DesactivarAccesoPublico: {
              type: 'Http'
              inputs: {
                method: 'PATCH'
                uri: '${environment().resourceManager}${substring(storage.id, 1)}?api-version=2023-05-01'
                body: {
                  properties: {
                    publicNetworkAccess: 'Disabled'
                  }
                }
                authentication: {
                  type: 'ManagedServiceIdentity'
                  audience: environment().resourceManager
                }
              }
            }
          }
          else: {
            actions: {}
          }
        }
      }
      outputs: {}
    }
  }
}

// La Logic App solo puede leer y modificar la cuenta (rol personalizado): ni claves ni datos.
resource corteRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, corte.id, corteRoleId)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', corteRoleId)
    principalId: corte.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource grupoCorte 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'ag-buenavista-corte'
  location: 'global'
  properties: {
    groupShortName: 'bvcorte'
    enabled: true
    logicAppReceivers: [
      {
        name: 'corte-storage'
        resourceId: corte.id
        callbackUrl: listCallbackUrl('${corte.id}/triggers/manual', '2019-05-01').value
        useCommonAlertSchema: true
      }
    ]
  }
}

resource presupuesto 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'presupuesto-buenavista'
  properties: {
    category: 'Cost'
    amount: presupuestoImporte
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: presupuestoInicio
    }
    notifications: {
      real50: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 50
        thresholdType: 'Actual'
        contactEmails: [
          avisosEmail
        ]
      }
      real100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: [
          avisosEmail
        ]
        contactGroups: [
          grupoCorte.id // solo el gasto real al 100 % corta
        ]
      }
      previsto50: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 50
        thresholdType: 'Forecasted'
        contactEmails: [
          avisosEmail
        ]
      }
      previsto100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [
          avisosEmail
        ]
      }
    }
  }
}

// Sin outputs secretos.
output swaName string = swa.name
output swaHostname string = swa.properties.defaultHostname
output storageName string = storage.name
