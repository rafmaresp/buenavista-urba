// Infraestructura de Buenavista I (spec 002-infra-bicep).
// Se despliega en el grupo de recursos que crea Rafa (rg-buenavista-incidencias) con infra.yml.
// Sin secretos en el repo: el SAS de datos se genera aquí y el correo de avisos llega como parámetro seguro.

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

// Sin tablas: cada cambio declara aquí las suyas (tableServices/tables).
resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

// SAS de cuenta: solo Table (ss=t), solo entidades (srt=o: no crea ni borra tablas),
// leer/añadir/actualizar/borrar entidades y consultar, solo HTTPS, caducidad de un año.
var tablesSas = storage.listAccountSas('2023-05-01', {
  signedServices: 't'
  signedResourceTypes: 'o'
  signedPermission: 'raudl'
  signedProtocol: 'https'
  signedExpiry: sasExpiry
  keyToSign: sasKey
}).accountSasToken

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
    TABLES_CONNECTION: 'TableEndpoint=${storage.properties.primaryEndpoints.table};SharedAccessSignature=${tablesSas}'
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
        // Solo actúa con una alerta de presupuesto con el esquema común; cualquier otra petición no corta.
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
