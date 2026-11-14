# Diseño — infra-bicep

> Reescrito el 2026-11-14 para Table Storage. Los precios marcados "a verificar" se contrastan con la calculadora de Azure en euros en la tarea 2.5.

## Contexto

- Stack cerrado (`docs/producto.md`): SWA Free con Functions gestionadas Node 22, **Azure Table Storage** con `@azure/data-tables`, región UE, coste 0–1 €/mes, facturación en **euros**.
- Restricción clave de la plataforma: las **Functions gestionadas de la SWA no admiten identidad administrada, referencias a Key Vault ni VNet** ([API support in SWA](https://learn.microsoft.com/azure/static-web-apps/apis-functions)). "Traer tus propias Functions" exige el plan Standard (de pago, ≈ 9 €/mes): descartado. Consecuencia: la API necesita una credencial en los app settings.
- Table Storage es de pago por uso, sin nivel gratuito ni tope de capacidad: se factura por GB almacenado y por transacciones. Con el volumen previsto (70 farolas, decenas de incidencias al mes, auditoría) son megabytes y unos miles de transacciones al mes.

## Goals / Non-Goals

**Goals**: infraestructura reproducible y revisable en PR; coste acotado por volumen (pago por uso con datos mínimos) y por vigilancia (presupuesto + corte); despliegue sin secretos de larga duración en GitHub.
**Non-Goals**: alta disponibilidad, redundancia geográfica, observabilidad (Application Insights), entornos de preview.

## Decisiones

### D1. Grupo de recursos existente, creado por Rafa
El Bicep se despliega a ámbito de grupo de recursos (`rg-buenavista-incidencias`, `westeurope`), que Rafa crea una vez.
- A favor: la identidad de despliegue solo tiene permisos de escritura en ese grupo (mínimo privilegio); el presupuesto con ámbito de grupo cubre todo lo que crea este repo y nada más.
- En contra: un paso manual.
- Descartado: despliegue a nivel de suscripción que crea el grupo; obliga a dar `Contributor` sobre toda la suscripción.

### D2. Acceso a los datos: SAS de cuenta limitado a entidades de Table, en un app setting
| Opción | Viable con SWA Free | Trade-off |
|---|---|---|
| **SAS de cuenta (`listAccountSas()`) limitado a Table y entidades** (elegida) | Sí | Bicep lo genera al desplegar y lo escribe en `staticSites/config/appsettings` (`TABLES_CONNECTION` = `TableEndpoint=…;SharedAccessSignature=…`); nunca pasa por el repo ni por GitHub. `signedServices: t`, `signedResourceTypes: o` (solo entidades: no puede crear ni borrar tablas), `signedPermission: raud` + `l`, `signedProtocol: https`, caducidad de 1 año (parámetro con `dateTimeAdd(utcNow(), 'P1Y')`). Cada deploy lo renueva. En contra: si nadie despliega en un año, la API deja de acceder (el README lo avisa) y revocarlo exige rotar la clave que lo firma. |
| Cadena de conexión con la clave de la cuenta | Sí | Más simple, pero la clave da control total: borrar tablas, usar blobs y colas (facturables). Descartado. |
| Entra ID (RBAC de datos de Table) con identidad administrada | No | Lo recomendado, pero las Functions gestionadas no tienen identidad. Se reevalúa si algún día se pasa a Functions propias. |
| Service principal + RBAC de datos, con secreto en app settings | Sí | Sigue habiendo un secreto de larga duración, más un objeto en Entra que mantener; el SAS ya acota el alcance. Sin ventaja suficiente. |
| Endpoint privado + `publicNetworkAccess: Disabled` | No | Las Functions gestionadas no se integran en VNet; además cuesta ≈ 7 €/mes. |

**A verificar** (tarea 2.4): que `TableClient.fromConnectionString` de `@azure/data-tables` acepta la cadena con `SharedAccessSignature` en Azure y en Azurite.

**D2b. Endurecimiento sin coste**: `minimumTlsVersion: TLS1_2`, `supportsHttpsTrafficOnly: true`, `allowBlobPublicAccess: false`, `allowCrossTenantReplication: false`, `allowSharedKeyAccess: true` (necesario para firmar el SAS), `networkAcls.defaultAction: Allow`. A diferencia de Cosmos, el firewall de Storage no tiene la regla "solo centros de datos de Azure", y las Functions gestionadas no son un "servicio de confianza" ni tienen IP fijas, así que no se puede restringir por red sin romper la API.

### D3. Cuenta de Storage
`StorageV2`, `Standard_LRS` (la redundancia más barata; los datos se pueden recargar desde el CSV y la auditoría es la única pérdida real, aceptable para este proyecto), `accessTier: Hot`, una región UE (`westeurope` por defecto, parámetro). Nombre global único: `stbuenavista<sufijo>` con `uniqueString(resourceGroup().id)`.

Coste estimado (**a verificar** en euros): almacenamiento de Table LRS ≈ 0,04 €/GB/mes y transacciones ≈ 0,0004 € por 10 000. Con < 100 MB y < 100 000 transacciones al mes: **≈ 0,01 €/mes**.

### D4. Tablas: en Bicep, cada una en el cambio que la necesita
| Opción | Trade-off |
|---|---|
| **Bicep** (elegida): cada cambio añade su `tableServices/tables` a `infra/` | Se revisa en el PR con `what-if`; compatible con el SAS sin permiso de tablas (D2); la app no crea tablas al arrancar. En contra: hay que ejecutar el deploy manual de `infra.yml` **antes** de desplegar la app que usa la tabla nueva. |
| Desde el código (`createTable` al arrancar) | Exige que la credencial pueda crear (y por tanto borrar) tablas; la estructura no se ve en el `what-if`. |

En las pruebas (Azurite en la CI y en local, a partir del cambio 2) el código de pruebas sí crea las tablas, a partir de **una única lista de nombres** en `api/` que el cambio 2 diseña; una prueba compara esa lista con las tablas de `infra/main.bicep` para que no se separen.

### D5. Corte automático: grupo de acciones → Logic App de consumo → `publicNetworkAccess = Disabled`
| Opción | Coste en reposo | Trade-off |
|---|---|---|
| **Logic App de consumo** (elegida) | 0 € | Declarable entera en Bicep (definición + acción HTTP con identidad administrada contra ARM). Se paga por acción ejecutada (≈ 0,00002 €/acción, **a verificar**). |
| Runbook de Automation | 0 € (500 min/mes gratis) | El contenido no se puede declarar inline en Bicep; módulos Az que mantener. |
| Function aparte | No es 0 | Necesita su propio plan y su propia cuenta de Storage. |

Qué corta: `PATCH` de la cuenta con `publicNetworkAccess: Disabled` (plano de control). Bloquea todo el tráfico del plano de datos por la red pública, que es la única vía de las Functions gestionadas. La app recibe errores al leer o escribir y muestra "servicio no disponible"; **ningún dato se borra**.

Identidad de la Logic App: ningún rol integrado sirve sin dar de más (`Storage Account Contributor` incluye `listKeys`, es decir, acceso a los datos). Se usa un **rol personalizado** `Buenavista corte de Storage` con solo `Microsoft.Storage/storageAccounts/read` y `Microsoft.Storage/storageAccounts/write`, asignable en el grupo. Crear definiciones de rol exige `Microsoft.Authorization/roleDefinitions/write`, que `Contributor` no tiene, así que **Rafa lo crea una vez** (paso 0.4, con un comando `az role definition create` que deja el README) y el Bicep solo lo asigna. Descartado rotar la clave: exige `regenerateKey` y deja la app con un SAS inválido distinto del desplegado.

Solo el aviso **real al 100 %** dispara el corte; el **previsto** al 100 % y los del 50 % solo envían correo.

Reactivación manual (documentada en `infra/README.md`): revisar la causa en Cost Management y ejecutar `infra.yml` (deploy), que vuelve a poner `publicNetworkAccess: Enabled`; o `az storage account update -n <cuenta> -g <rg> --public-network-access Enabled`. Como el deploy reactiva, **el deploy es manual** (D6).

Límites honestos: **Table Storage no tiene tope duro de gasto** (Cosmos sí lo tenía con el nivel gratuito). Los datos de coste de Azure llegan con 8–24 h de retraso, así que el corte es un **respaldo**, no un freno en tiempo real. Cuánto margen hay: 1 € ≈ 25 millones de transacciones (estimación). Una fuga del SAS permitiría gastar más deprisa que el corte; las mitigaciones son el alcance limitado del SAS (D2), la rotación documentada, el límite de peticiones por usuario y la caché de los GET anónimos en la API (cambio 2 en adelante), y los límites propios de las Functions gestionadas de la SWA Free.

#### Coste del mecanismo de corte (estimado, en euros)
| Pieza | Coste |
|---|---|
| Presupuesto | 0 € |
| Grupo de acciones: 4 correos/mes como mucho | 0 € (primeros 1000 correos/mes gratis) |
| Grupo de acciones → Logic App | ≈ 0 € (**a verificar**) |
| Logic App en reposo | 0 € |
| Ejecución del corte: ~3 acciones | ≈ 0,0001 € por corte |
| Identidad administrada, rol personalizado y asignación | 0 € |
| **Total esperado** | **≈ 0,00 €/mes** |

Riesgo: la URL del desencadenador HTTP (con firma SAS) permite invocar la Logic App; si se filtrara provocaría un corte (denegación de servicio, no fuga de datos). Mitigación: la URL se obtiene con `listCallbackUrl()` en el despliegue y solo vive en el grupo de acciones; la Logic App comprueba que el cuerpo es una alerta de presupuesto con el esquema común antes de actuar.

### D6. Despliegue: OIDC, dos identidades, `what-if` en PR, deploy manual
- `infra.yml`: en PR que tocan `infra/**` → `az deployment group what-if` (resultado en el resumen del job). En `workflow_dispatch` → `az deployment group create`.
- Ambos jobs usan el entorno de GitHub **`infra`**, con Rafa como revisor obligatorio: ningún código de un PR obtiene el token de Azure sin su aprobación.
- **Dos identidades administradas asignadas por el usuario** con credencial federada (sin secretos):
  - `id-buenavista-infra` (sujeto `environment:infra`): `Contributor` y `Role Based Access Control Administrator` (con condición: solo puede asignar el rol personalizado de corte y `Contributor`) en el grupo.
  - `id-buenavista-app` (sujeto `environment:produccion`, rama `main`): `Contributor` **solo sobre el recurso SWA**, asignado por el Bicep. Solo sirve para leer el token de despliegue.
- Deploy manual frente a "al fusionar": la infraestructura cambia poco, el deploy reactiva Storage tras un corte (D5) y Rafa decide cuándo se crean recursos. En contra: puede quedar deriva si se olvida desplegar (también una tabla nueva, D4) o el SAS puede caducar si no se despliega en un año; el `what-if` del PR y el README lo hacen visible.
- Correo de avisos: secreto del entorno `infra` (`AVISOS_EMAIL`), pasado como parámetro `@secure()`; nunca en el repo.
- Desaparece la comprobación de nivel gratuito del diseño con Cosmos (D6 anterior): Storage no tiene nivel gratuito por suscripción.

### D7. `azure-swa.yml` obtiene el token por OIDC
Antes del paso de despliegue: `azure/login` con `id-buenavista-app` y `az staticwebapp secrets list --query properties.apiKey -o tsv`, enmascarado con `::add-mask::` y pasado como `azure_static_web_apps_api_token`. Se elimina el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN`. Solo push a `main`: **sin previews de PR**, y además `stagingEnvironmentPolicy: Disabled` en la SWA. Si falta la variable `AZURE_CLIENT_ID_APP`, termina en verde con aviso.

## Recursos (resumen de propiedades)
- `Microsoft.Web/staticSites` (Free, `westeurope`, `stagingEnvironmentPolicy: Disabled`, `allowConfigFileUpdates: true`) + `config/appsettings` (`TABLES_CONNECTION`).
- `Microsoft.Storage/storageAccounts` (`kind: StorageV2`, `sku: Standard_LRS`, `accessTier: Hot`, `minimumTlsVersion: TLS1_2`, `supportsHttpsTrafficOnly: true`, `allowBlobPublicAccess: false`, `allowCrossTenantReplication: false`, `allowSharedKeyAccess: true`, `publicNetworkAccess: Enabled`, `networkAcls.defaultAction: Allow`).
- `Microsoft.Storage/storageAccounts/tableServices` `default`. Sin `tables` en este cambio.
- `Microsoft.Logic/workflows` (consumo, identidad asignada por el sistema) + asignación del rol personalizado de corte sobre la cuenta.
- `Microsoft.Insights/actionGroups` (región `global`, `logicAppReceivers` con `useCommonAlertSchema: true`).
- `Microsoft.Consumption/budgets` (importe `1`, en euros; `Monthly`, `startDate` fija en el `.bicepparam`; notificaciones `Actual` 50/100 y `Forecasted` 50/100; `contactGroups` solo en `Actual` 100).
- Sin `outputs` con secretos.

## Riesgos
- Sin tope duro de gasto y el corte llega con retraso (D5); mitigado por el alcance del SAS, el límite de peticiones y el presupuesto.
- Con el SAS filtrado, alguien puede leer y escribir entidades (no borrar tablas ni usar otros servicios). Mitigación: rotación documentada (regenerar la clave que firma el SAS y desplegar).
- Caducidad del SAS: si no se despliega en un año, la API pierde el acceso. Mitigación: aviso en el README y en el aviso de despliegue; se puede alargar el parámetro.
- Una tabla nueva exige desplegar `infra.yml` antes que la app (D4).

## Preguntas abiertas
Ninguna para Rafa. Quedan las verificaciones de las tareas 2.4 (cadena con SAS en `@azure/data-tables`) y 2.5 (permisos del rol personalizado y tarifas en euros).
