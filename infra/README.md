# Infraestructura (Azure)

Todo lo de Azure se declara en `main.bicep` y se valida en los PR con [`infra.yml`](../.github/workflows/infra.yml) y se despliega con [`infra-desplegar.yml`](../.github/workflows/infra-desplegar.yml), que lanza [`azure-swa.yml`](../.github/workflows/azure-swa.yml) cuando un push a `main` toca `infra/**` o `data/**` (con la aprobación de Rafa). Diseño y decisiones: [`specs/002-infra-bicep/`](../specs/002-infra-bicep/).

| Recurso | Nombre | Región | Coste esperado |
|---|---|---|---|
| Static Web App Free | `swa-buenavista` | `eastus2` **provisional** (ver abajo); destino `westeurope` | 0 € |
| Cuenta de Storage (solo Table) | `stbuenavista…` | `spaincentral` | ≈ 0,01 €/mes (estimación) |
| Logic App de corte (consumo) | `logic-buenavista-corte` | `spaincentral` | 0 € en reposo |
| Grupo de acciones | `ag-buenavista-corte` | global | 0 € |
| Presupuesto de 1 €/mes | `presupuesto-buenavista` | grupo de recursos | 0 € |

`westeurope` no admite recursos nuevos en esta suscripción (`RequestDisallowedByAzure`), por eso Storage, la Logic App y las identidades van en `spaincentral`. La SWA Free solo existe en `westeurope` dentro de la UE, así que va **provisionalmente en `eastus2`, sin datos reales**, hasta que Microsoft dé acceso a `westeurope` (decisión del 2026-11-15). Entonces: `az staticwebapp delete -n swa-buenavista -g rg-buenavista-incidencias --yes`, `swaLocation = 'westeurope'` en `main.bicepparam`, fusionar y desplegar. El grupo de recursos sí está en `westeurope`: solo guarda metadatos.

## Pasos únicos (ya hechos el 15-11-2026)

Desde Azure Cloud Shell en **Bash**:

```bash
RG=rg-buenavista-incidencias
# GitHub firma el token OIDC con el sujeto «repo:<owner>@<id>/<repo>@<id>:environment:<entorno>»
# (identificadores inmutables). Lo muestra el error AADSTS700213 si no coincide.
SUJ=repo:rafmaresp@34618721/buenavista-urba@1451594037
LOC=spaincentral
SCOPE=/subscriptions/<suscripción>/resourceGroups/$RG

# Proveedores y grupo
for p in Microsoft.Storage Microsoft.Web Microsoft.Logic Microsoft.Insights Microsoft.CostManagement Microsoft.Consumption Microsoft.ManagedIdentity; do az provider register -n $p; done
az group create -n $RG -l westeurope

# Identidades de GitHub (OIDC, sin secretos)
for n in infra app; do az identity create -g $RG -n id-buenavista-$n -l $LOC -o none; done
az identity federated-credential create -g $RG --identity-name id-buenavista-infra -n github-infra --issuer https://token.actions.githubusercontent.com --subject $SUJ:environment:infra --audiences api://AzureADTokenExchange
az identity federated-credential create -g $RG --identity-name id-buenavista-app -n github-produccion --issuer https://token.actions.githubusercontent.com --subject $SUJ:environment:produccion --audiences api://AzureADTokenExchange

# Rol de corte: solo leer y modificar la cuenta (ni claves ni datos)
cat > rol-corte.json <<JSON
{ "Name": "Buenavista corte de Storage",
  "Description": "Solo leer y modificar la cuenta de Storage para cortar el acceso de red. No lee claves ni datos.",
  "Actions": ["Microsoft.Storage/storageAccounts/read", "Microsoft.Storage/storageAccounts/write"],
  "NotActions": [], "DataActions": [], "NotDataActions": [], "AssignableScopes": ["$SCOPE"] }
JSON
az role definition create --role-definition @rol-corte.json

# Permisos de id-buenavista-infra: Contributor y administrador de RBAC limitado al rol de corte y a Contributor
set +H
CORTE=$(az role definition list --custom-role-only true --name "Buenavista corte de Storage" --query "[0].name" -o tsv)
CONTRIB=b24988ac-6180-42a0-ab88-20f7382dd24c
INFRA=$(az identity show -g $RG -n id-buenavista-infra --query principalId -o tsv)
az role assignment create --assignee-object-id $INFRA --assignee-principal-type ServicePrincipal --role Contributor --scope $SCOPE
COND="((!(ActionMatches{'Microsoft.Authorization/roleAssignments/write'})) OR (@Request[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {$CORTE, $CONTRIB})) AND ((!(ActionMatches{'Microsoft.Authorization/roleAssignments/delete'})) OR (@Resource[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {$CORTE, $CONTRIB}))"
az role assignment create --assignee-object-id $INFRA --assignee-principal-type ServicePrincipal --role "Role Based Access Control Administrator" --scope $SCOPE --condition "$COND" --condition-version 2.0
```

En GitHub (Settings del repo):

- Entorno `infra` con revisor obligatorio `rafmaresp` (sin *Prevent self-reviews*) y el secreto de entorno `AVISOS_EMAIL`.
- Entorno `produccion` limitado a la rama `main`.
- Variables del repositorio: `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_CLIENT_ID_INFRA` y `AZURE_CLIENT_ID_APP` (los `clientId` de las identidades; no son secretos).

## Desplegar

Regla (decisión de Rafa del 2026-11-15): **solo un cambio de infraestructura de Azure pide su aprobación**; lo demás se despliega solo al fusionar en `main`.

1. Un PR que toca `infra/**` valida el Bicep y, cuando Rafa aprueba el entorno `infra`, publica el `what-if` en el resumen del job (solo recursos y tipo de cambio: las propiedades llevarían el SAS y el correo).
2. Al fusionar, **Despliegue Azure Static Web Apps** (`azure-swa.yml`) mira qué ha cambiado desde el último commit con la infra desplegada bien (así un despliegue de infra rechazado, fallido o cancelado se vuelve a pedir en el siguiente push):
   - Si cambió `infra/**`, `data/**` o `infra-desplegar.yml`: llama a **Desplegar infraestructura (Bicep)**, que espera la aprobación de Rafa en el entorno `infra` y en un solo job despliega el Bicep y siembra las farolas que falten (solo altas, cada una auditada con `sistema:carga`; si no falta ninguna dice "Altas: 0"). Si se rechaza o falla, la app no se despliega.
   - Siempre, al final: despliega la app (`web/` y `api/`) sin aprobación.
   - Después de desplegar la app, **verifica el entorno real**: un GET anónimo a `/api/health` (hasta 10 intentos, porque la SWA tarda en propagar). Si no responde, el job queda en rojo. Es lo mínimo por ahora; los e2e de la CI corren en local con un emulador de Storage, no contra Azure.
3. A mano (*Run workflow* en `main`), **Desplegar infraestructura (Bicep)** sirve para reactivar Storage tras un corte o renovar los SAS.

Una tabla nueva se declara en `main.bicep` (`tableServices/tables`) y se añade a `TABLAS` en `api/src/tablas.ts` (un test comprueba que coinciden). Como el PR toca `infra/**`, la infraestructura se despliega antes que la app que la usa: la app no puede crear tablas.

Tras desplegar, `https://<swa>/api/farolas` debe devolver 70 farolas sin `precision`.

## Reactivar tras un corte

Si el gasto real del mes llega a 1 €, la Logic App pone la cuenta de Storage en `publicNetworkAccess: Disabled`. La API deja de acceder a los datos, pero no se borra nada.

1. Revisa la causa en el portal: Cost Management → Análisis de costes del grupo `rg-buenavista-incidencias`.
2. Corrige la causa (por ejemplo, rota el SAS si se ha filtrado; ver abajo).
3. Ejecuta **a mano** **Desplegar infraestructura (Bicep)** (`infra-desplegar.yml`, *Run workflow* en `main`), que vuelve a poner `publicNetworkAccess: Enabled`. Alternativa inmediata: `az storage account update -g rg-buenavista-incidencias -n <cuenta> --public-network-access Enabled`.

Mientras Storage esté cortado, un push a `main` con cambios de infra falla antes de desplegar (y no despliega la app): solo se reactiva a mano. Un push sin cambios de infra despliega la app normalmente.

Los datos de coste llegan con 8–24 h de retraso: el corte es un respaldo, no un freno en tiempo real.

**Ojo:** el presupuesto avisa una sola vez por umbral y mes. Si reactivas Storage en el mismo mes del corte, no habrá otro corte automático hasta el mes siguiente: vigila el gasto a mano o sube el importe con `presupuestoImporte` si el gasto es legítimo.

### Probar el corte (una vez, tras el primer despliegue)

La Logic App solo corta si el cuerpo trae `schemaId = azureMonitorCommonAlertSchema`, `monitoringService = CostAlerts`, `AlertCategory = budgets` y `ThresholdType = Actual`, como la muestra oficial *Cost budget alert*.

1. Portal → Monitor → Alertas → Grupos de acciones → `ag-buenavista-corte` → **Probar**, tipo *Budget alert*. La muestra que envía Azure es de gasto **previsto**, así que **no** debe cortar: en el historial de ejecuciones de la Logic App la condición sale `false`.
2. Desde el historial de esa ejecución, **Reenviar** no sirve para probar el corte. Para probarlo de verdad, en el diseñador de la Logic App ejecuta el desencadenador con el JSON de *Cost budget alert* de la página de muestras: la cuenta pasa a `publicNetworkAccess: Disabled` y los datos siguen ahí.
3. Reactiva con el procedimiento de arriba.

## SAS de datos (uno por tabla)

- El despliegue genera un **SAS de servicio por tabla** con la clave de la cuenta (`sasKey`, por defecto `key1`), solo HTTPS, y lo guarda en su app setting:

  | App setting | Tabla | Permisos | Por qué |
  |---|---|---|---|
  | `FAROLAS_CONNECTION` | `Farolas` | `ru` (consultar y actualizar) | La app lee el catálogo y la directiva reubica farolas (spec 008); añadir llegará con `POST` |
  | `AUDITORIA_CONNECTION` | `Auditoria` | `ra` (consultar y añadir) | Append-only: la app no puede modificar ni borrar la auditoría |
  | `USUARIOS_CONNECTION` | `Usuarios` | `ru` (consultar y actualizar) | La app solo fija el `sub` en el primer login; altas y bajas no van por la app |
  | `INCIDENCIAS_CONNECTION` | `Incidencias` | `rad` (consultar, añadir y borrar) | La app da de alta incidencias; borrar solo para deshacer un alta cuya auditoría falle. El cambio de gestión de estados añadirá actualizar |

- Un SAS de servicio solo vale para su tabla y no crea ni borra tablas. Si `listServiceSas` no devuelve `tn=<tabla>` en el token, el Bicep lo añade.
- **Caducan un año después de cada despliegue de infraestructura.** Si en un año no cambia la infra, la API pierde el acceso: lanza **Desplegar infraestructura (Bicep)** a mano antes.
- La carga de farolas (dentro de **Desplegar infraestructura (Bicep)**) no usa estos SAS: firma los suyos al vuelo, de 1 h (`Farolas: rad`, con borrado solo para deshacer un alta cuya auditoría falle; `Auditoria: a`), y los enmascara en el log.
- `main.bicep` sustituye **todos** los app settings de la SWA: cualquier otro setting de la app se declara ahí.

### Rotar claves (si el SAS se filtra)

Los SAS de tabla (`FAROLAS_CONNECTION`, `AUDITORIA_CONNECTION`, `USUARIOS_CONNECTION` e `INCIDENCIAS_CONNECTION`) no usan política de acceso almacenada, así que solo se revocan regenerando la clave que los firma:

1. Regenera la clave que **no** firma (`key2`): `az storage account keys renew -g rg-buenavista-incidencias -n <cuenta> --key key2`.
2. Cambia `sasKey` a `'key2'` en `main.bicepparam`, fusiona y despliega: la app pasa a los SAS de tabla firmados con `key2`.
3. Regenera `key1`: el SAS filtrado deja de valer.

## Login con Google (cliente OAuth)

El login (spec `005-login-roles`) necesita un cliente OAuth de Google, gratuito. Lo crea Rafa una vez:

1. [Google Cloud Console](https://console.cloud.google.com/) → crea un proyecto (p. ej. `buenavista-incidencias`).
2. **Google Auth Platform → Branding / Audience**: tipo **External**, estado **Testing**, y añade como *test users* las cuentas que vayan a probar. Mientras esté en Testing solo entran esas cuentas, que es lo que queremos con la SWA provisional fuera de la UE.
3. **Clients → Create client → Web application**. *Authorized JavaScript origins*: la URL de la SWA (`https://<swa>.azurestaticapps.net`) y `http://localhost:4280`. Sin *redirect URIs*.
4. Copia el **Client ID** (`….apps.googleusercontent.com`; no es secreto, aparece en la página) en `param googleClientId` de `main.bicepparam`, fusiona y aprueba el despliegue de infra.

Sin `googleClientId`, `/login` dice que el inicio de sesión no está disponible y las Functions no públicas responden 503 a peticiones con token.
