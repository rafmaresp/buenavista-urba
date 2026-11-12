# Diseño — infra-bicep

## Contexto

- Stack cerrado (`openspec/project.md`): SWA Free con Functions gestionadas Node 22, Cosmos DB for Table con nivel gratuito, `@azure/data-tables`, región UE, coste 0–1 €/mes.
- Restricción clave de la plataforma: las **Functions gestionadas de la SWA no admiten identidad administrada, referencias a Key Vault ni VNet** ([API support in SWA](https://learn.microsoft.com/azure/static-web-apps/apis-functions)). "Traer tus propias Functions" exige el plan Standard (≈ 9 $/mes): descartado.
- **Bicep no puede declarar la capacidad compartida a nivel de cuenta en la API de Table** ("Enabling account-level throughput cannot be done using ARM templates or Bicep", [Manage Cosmos DB for Table with Bicep](https://learn.microsoft.com/azure/cosmos-db/table/manage-with-bicep)). La documentación remite a la CLI o PowerShell, pero el comando citado (`az cosmosdb table throughput migrate`) es por tabla y hay informes de que no la activa. Ver decisión D3.

## Goals / Non-Goals

**Goals**: infraestructura reproducible y revisable en PR; coste acotado por diseño (tope de RU/s) y por vigilancia (presupuesto + corte); despliegue sin secretos de larga duración.
**Non-Goals**: alta disponibilidad, multirregión, observabilidad (Application Insights), entornos de preview.

## Decisiones

### D1. Grupo de recursos existente, creado por Rafa
El Bicep se despliega a ámbito de grupo de recursos (`rg-buenavista-incidencias`, `westeurope`), que Rafa crea una vez.
- A favor: la identidad de despliegue solo tiene permisos de escritura en ese grupo (mínimo privilegio); el presupuesto con ámbito de grupo cubre todo lo que crea este repo y nada más.
- En contra: un paso manual; la identidad necesita además `Reader` en la suscripción para la comprobación de nivel gratuito (solo lectura).
- Descartado: despliegue a nivel de suscripción que crea el grupo; obliga a dar `Contributor` sobre toda la suscripción.

### D2. Acceso a Cosmos: clave de cuenta en app settings de la SWA, con firewall "centros de datos de Azure"
| Opción | Viable con SWA Free | Trade-off |
|---|---|---|
| **Cadena de conexión con clave de cuenta en app setting** (elegida) | Sí | Secreto de larga duración, pero vive solo en Azure: Bicep lo lee con `listConnectionStrings()` al desplegar y lo escribe en `staticSites/config/appsettings`; nunca pasa por el repo ni por GitHub. Quien tenga `Contributor` en la SWA puede leerlo. Rotación manual documentada. |
| Entra ID / RBAC de datos con identidad administrada | No | Las Functions gestionadas no tienen identidad administrada. |
| Service principal con secreto en app settings | Sí | El mismo secreto de larga duración, más un objeto en Entra que mantener. Sin ventaja. |
| Endpoint privado + `publicNetworkAccess: Disabled` | No | Las Functions gestionadas no se integran en VNet; además el endpoint privado cuesta ≈ 7 €/mes. |
| SAS de tabla con caducidad | Parcial | Habría que renovarlo y redesplegar; complejidad sin ganancia real. |

Endurecimiento sin coste: `ipRules: [0.0.0.0]` ("aceptar solo desde centros de datos públicos de Azure"; bloquea Internet doméstico, no a otros clientes de Azure), `minimalTlsVersion: Tls12`, `disableKeyBasedMetadataWriteAccess: true` (con la clave no se pueden crear ni borrar tablas: se declaran en Bicep), `disableLocalAuth: false` (necesaria para la clave). Parámetro opcional `ipsDevs` para abrir temporalmente la IP de un dev (cargas de datos); por defecto vacío. **A verificar** (tarea 2.4): que las Functions gestionadas conectan con esa regla; si no, se quita la regla y se documenta.

### D3. Capacidad compartida: verificar fuera de Bicep, con plan B de tabla única
Con el tope de cuenta de 1000 RU/s y un mínimo de 400 RU/s por tabla dedicada, solo caben 2 tablas dedicadas; el roadmap necesita ≥ 6. Por eso la capacidad debe ser compartida a nivel de cuenta.
- Plan A: tras el primer despliegue (cuenta sin tablas), activar la capacidad compartida de 1000 RU/s manuales con la CLI/REST de gestión o, si no funciona, desde el portal (paso único de Rafa). El workflow lo comprueba en cada despliegue y falla si no está (tarea 3.4).
- Plan B (si no se consigue de forma fiable): una sola tabla `Datos` con 1000 RU/s dedicadas y el tipo de entidad como prefijo de `PartitionKey` (`farola`, `aud:AAAA-MM`, `usr`…). Afecta al diseño del cambio 2; se decide con Rafa antes de empezarlo.
- Las tablas las declara Bicep **sin** `options.throughput` (a verificar en el cambio 2 que ARM las coloca en la capacidad compartida).

### D4. Corte automático: grupo de acciones → Logic App de consumo → `publicNetworkAccess = Disabled`
| Opción | Coste en reposo | Trade-off |
|---|---|---|
| **Logic App de consumo** (elegida) | 0 € | Declarable entera en Bicep (definición + acción HTTP con identidad administrada contra ARM). Se paga por acción ejecutada (≈ 0,000025 $/acción integrada, **a verificar** en la tarifa vigente). |
| Runbook de Automation | 0 € (500 min/mes gratis) | El contenido del runbook no se puede declarar inline en Bicep (exige `publishContentLink` a una URL o un paso extra de subida); módulos Az que mantener. |
| Function aparte | No es 0 | Necesita su propio plan y una cuenta de Storage de pago por uso. |

Qué corta: `PATCH` de la cuenta con `publicNetworkAccess: Disabled` (plano de control). Efecto: la app recibe errores al leer o escribir y muestra "servicio no disponible"; **ningún dato se borra**. La identidad de la Logic App tiene el rol **Cosmos DB Operator** solo sobre la cuenta (gestiona la cuenta pero no lee claves). Descartado rotar la clave: exige permisos `listKeys/regenerateKey` y deja la app con una clave rota distinta de la desplegada.

Solo el aviso **real al 100 %** dispara el corte; el **previsto** al 100 % y los del 50 % solo envían correo (un previsto de 1 € no justifica dejar sin servicio).

Reactivación manual (documentada en `infra/README.md`): revisar la causa en Cost Management y ejecutar `infra.yml` (deploy), que vuelve a poner `publicNetworkAccess: Enabled`; o `az cosmosdb update -n <cuenta> -g <rg> --public-network-access ENABLED`. Como el deploy reactiva, **el deploy es manual** (D6): una fusión cualquiera no reabre el acceso tras un corte.

Límites honestos: los datos de coste de Azure llegan con 8–24 h de retraso y el presupuesto se evalúa con ese retraso, así que el corte es un **respaldo**, no un freno en tiempo real. La protección principal es el tope `totalThroughputLimit = 1000`: con el nivel gratuito, las RU/s no pueden facturar. Lo que podría facturar: > 25 GB de datos, copias de backup extra o activar a mano una función de pago; todo eso lo vigila el presupuesto.

#### Coste del mecanismo de corte (estimado)
| Pieza | Coste |
|---|---|
| Presupuesto | 0 € |
| Grupo de acciones: 4 correos/mes como mucho | 0 € (primeros 1000 correos/mes gratis) |
| Grupo de acciones → Logic App | ≈ 0 € (**a verificar** en la tarifa de Azure Monitor) |
| Logic App en reposo | 0 € |
| Ejecución del corte: ~3 acciones (desencadenador, condición, HTTP) | ≈ 0,0001 € por corte; ≤ 1–2 cortes/mes |
| Identidad administrada y asignación de rol | 0 € |
| **Total esperado** | **≈ 0,00 €/mes** |

Riesgo: la URL del desencadenador HTTP (con firma SAS) permite invocar la Logic App; si se filtrara, cada llamada cuesta ≈ 0,0001 € y provocaría un corte (denegación de servicio, no fuga de datos). Mitigación: la URL se obtiene con `listCallbackUrl()` en el despliegue y solo vive en el grupo de acciones; la Logic App comprueba que el cuerpo es una alerta de presupuesto con el esquema común antes de actuar.

### D5. Comprobación previa de nivel gratuito
Solo puede haber una cuenta de Cosmos con nivel gratuito por suscripción y `enableFreeTier` no se puede cambiar tras crear la cuenta. Antes del `what-if` y del deploy, `infra.yml` lista las cuentas de la suscripción (`az cosmosdb list`) y **falla** si hay alguna con `enableFreeTier = true` distinta de la nuestra. Así nunca se crea una cuenta de pago por error.

### D6. Despliegue: OIDC, dos identidades, `what-if` en PR, deploy manual
- `infra.yml`: en PR que tocan `infra/**` → comprobación de nivel gratuito + `az deployment group what-if` (resultado en el resumen del job). En `workflow_dispatch` → comprobación + `az deployment group create`.
- Ambos jobs usan el entorno de GitHub **`infra`**, con Rafa como revisor obligatorio: ningún código de un PR obtiene el token de Azure sin su aprobación. Trade-off: Rafa aprueba también los `what-if` (pocos; solo PR de `infra/**`).
- **Dos identidades administradas asignadas por el usuario** con credencial federada (sin secretos):
  - `id-buenavista-infra` (sujeto `environment:infra`): `Contributor` y `Role Based Access Control Administrator` (con condición: solo puede asignar `Cosmos DB Operator` y `Contributor`) en el grupo; `Reader` en la suscripción.
  - `id-buenavista-app` (sujeto `environment:produccion`, rama `main`): `Contributor` **solo sobre el recurso SWA**, asignado por el Bicep. Solo sirve para leer el token de despliegue.
- Deploy manual frente a "al fusionar": la infraestructura cambia poco, el deploy reactiva Cosmos tras un corte (D4) y Rafa decide cuándo se crean recursos. En contra: puede quedar deriva si se olvida desplegar; el `what-if` del PR la hace visible.
- Correo de avisos: secreto del entorno `infra` (`AVISOS_EMAIL`), pasado como parámetro `@secure()`; nunca en el repo.

### D7. `azure-swa.yml` obtiene el token por OIDC
Antes del paso de despliegue: `azure/login` con `id-buenavista-app` y `az staticwebapp secrets list --query properties.apiKey -o tsv`, enmascarado con `::add-mask::` y pasado como `azure_static_web_apps_api_token`. Se elimina el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN`. El workflow solo se dispara en push a `main` (se quita el disparador `pull_request` si lo hubiera): **sin previews de PR**, y además `stagingEnvironmentPolicy: Disabled` en la SWA. Si falta la variable `AZURE_CLIENT_ID_APP`, termina en verde con aviso, como antes sin token.

## Recursos (resumen de propiedades)
- `Microsoft.Web/staticSites` (Free, `westeurope`, `stagingEnvironmentPolicy: Disabled`, `allowConfigFileUpdates: true`) + `config/appsettings` (`COSMOS_TABLES_CONNECTION`).
- `Microsoft.DocumentDB/databaseAccounts` (`kind: GlobalDocumentDB`, `capabilities: [EnableTable]`, `enableFreeTier: true`, `capacity.totalThroughputLimit: 1000`, una `location` con `isZoneRedundant: false`, `enableMultipleWriteLocations: false`, `enableAutomaticFailover: false`, `enableAnalyticalStorage: false`, `backupPolicy` periódica por defecto (cada 240 min, 8 h de retención, redundancia local; dentro de las 2 copias gratuitas), `publicNetworkAccess: Enabled`, `ipRules`, `minimalTlsVersion: Tls12`, `disableKeyBasedMetadataWriteAccess: true`).
- `Microsoft.Logic/workflows` (consumo, identidad asignada por el sistema) + asignación de `Cosmos DB Operator` sobre la cuenta.
- `Microsoft.Insights/actionGroups` (región `global`, `logicAppReceivers` con `useCommonAlertSchema: true`).
- `Microsoft.Consumption/budgets` (1, `Monthly`, `startDate` fija en el `.bicepparam`; notificaciones `Actual` 50/100 y `Forecasted` 50/100; `contactGroups` solo en `Actual` 100).
- Sin `outputs` con secretos.
- Región de Cosmos: parámetro, por defecto `westeurope`; si la región no admite cuentas nuevas por capacidad, `northeurope` o `spaincentral` (UE). Las Functions gestionadas corren en la región de la SWA.

## Riesgos
- El presupuesto se mide en la moneda de facturación: si la cuenta factura en USD, "1" es 1 $.
- El corte llega con retraso (D4); mitigado por el tope de RU/s.
- Capacidad compartida no declarable (D3); plan B definido.
- Con la clave filtrada, alguien desde Azure puede leer y escribir datos (no crear tablas ni facturar RU/s). Mitigación: rotación documentada.

## Preguntas abiertas
1. ¿La cuenta de facturación de Rafa está en EUR?
2. ¿Plan B de tabla única aceptable si la capacidad compartida no se puede activar fuera del portal?
