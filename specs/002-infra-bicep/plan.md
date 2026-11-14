# Diseño — infra-bicep

## Contexto

- Stack cerrado (`docs/producto.md`): SWA Free con Functions gestionadas Node 22, **Cosmos DB for NoSQL** con nivel gratuito, SDK `@azure/cosmos`, región UE, coste 0–1 €/mes, facturación en **euros**.
- Restricción clave de la plataforma: las **Functions gestionadas de la SWA no admiten identidad administrada, referencias a Key Vault ni VNet** ([API support in SWA](https://learn.microsoft.com/azure/static-web-apps/apis-functions)). "Traer tus propias Functions" exige el plan Standard (de pago, ≈ 9 €/mes): descartado.
- Nivel gratuito de Cosmos ([Lifetime Free Tier](https://learn.microsoft.com/azure/cosmos-db/free-tier), [Service quotas](https://learn.microsoft.com/azure/cosmos-db/concepts-limits)): las primeras **1000 RU/s y 25 GB** de la cuenta son gratis; una sola cuenta gratuita por suscripción; `enableFreeTier` solo se fija al crear la cuenta. "When using the free tier, you can provision a shared database with up to 1000 RU/s for free. All containers in the database share the throughput." Una base de datos con capacidad compartida admite **como mucho 25 contenedores**.

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
| **Cadena de conexión con clave de cuenta en app setting** (elegida) | Sí | Secreto de larga duración, pero vive solo en Azure: Bicep lo lee con `listConnectionStrings()` al desplegar y lo escribe en `staticSites/config/appsettings` (`COSMOS_CONNECTION`); nunca pasa por el repo ni por GitHub. Quien tenga `Contributor` en la SWA puede leerlo. Rotación manual documentada. |
| Entra ID / RBAC de datos de NoSQL (`sqlRoleAssignments`) con identidad administrada | No | La API de NoSQL sí lo admite y es lo recomendado, pero las Functions gestionadas no tienen identidad administrada. Se reevalúa si algún día se pasa a Functions propias. |
| Service principal + RBAC de datos, con secreto en app settings | Sí | Sigue habiendo un secreto de larga duración en los app settings, más un objeto en Entra que mantener; solo gana granularidad (rol de datos sin metadatos), que ya da D2b. Sin ventaja suficiente. |
| Clave de solo lectura para los GET anónimos + clave completa para escrituras | Sí | Dos secretos en el mismo sitio y quien lee uno lee el otro: no reduce la exposición. Descartado. |
| Tokens de recurso (permisos por contenedor) | Parcial | Exigen un servicio que los emita con la clave maestra y renovarlos (≤ 24 h); complejidad sin ganancia. |
| Endpoint privado + `publicNetworkAccess: Disabled` | No | Las Functions gestionadas no se integran en VNet; además el endpoint privado cuesta ≈ 7 €/mes. |

**D2b. Endurecimiento sin coste**: `ipRules: [0.0.0.0]` ("aceptar solo desde centros de datos públicos de Azure"; bloquea Internet doméstico, no a otros clientes de Azure), `minimalTlsVersion: Tls12`, `disableKeyBasedMetadataWriteAccess: true` (con la clave no se pueden crear, modificar ni borrar bases de datos ni contenedores, ni cambiar su capacidad: una clave filtrada no puede borrar un contenedor entero ni intentar subir RU/s), `disableLocalAuth: false` (necesaria para la clave). Parámetro opcional `ipsDevs` para abrir temporalmente la IP de un dev (cargas de datos); por defecto vacío. **A verificar** (tarea 2.4): que las Functions gestionadas conectan con esa regla; si no, se quita la regla y se documenta.

### D3. Capacidad: una base de datos con 1000 RU/s compartidas, sin contenedores en este cambio
Sintaxis Bicep verificada ([sqlDatabases, referencia de plantillas](https://learn.microsoft.com/azure/templates/microsoft.documentdb/databaseaccounts/sqldatabases); ejemplo "Free tier Azure Cosmos DB account" en [Manage with Bicep](https://learn.microsoft.com/azure/cosmos-db/manage-with-bicep)):

```bicep
resource db 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cuenta
  name: 'buenavista'
  properties: {
    resource: { id: 'buenavista' }
    options: { throughput: 1000 }   // manual, compartida por todos los contenedores
  }
}
```

- Límites ([Service quotas](https://learn.microsoft.com/azure/cosmos-db/concepts-limits)): mínimo de una base de datos compartida manual = `MAX(400, GB almacenados × 1, máximo histórico / 100, 400 + MAX(contenedores − 25, 0) × 100)` → 400 RU/s para nosotros; máximo del recurso 1 000 000 RU/s, pero el **tope efectivo es 1000**: lo que pase de 1000 se factura y `totalThroughputLimit: 1000` hace que Azure rechace cualquier aprovisionamiento por encima. Con 25 GB como máximo gratuito, el mínimo por almacenamiento nunca pasa de 25 RU/s.
- **1000 manuales, no autoescalado**: el autoescalado con máximo 1000 factura como mínimo el 10 % y se mide por hora en un rango 100–1000; con el nivel gratuito ambos son 0 €, pero manual es más simple y su mínimo (400) deja margen para bajar si algún día hiciera falta otra base de datos.
- **Consecuencia del tope**: la base de datos consume las 1000 RU/s de la cuenta, así que **ningún contenedor puede tener RU/s dedicadas** (el despliegue fallaría). Es deseable: fuerza que todo vaya a la capacidad compartida. Máximo 25 contenedores (el roadmap prevé ~7).
- Desaparecen el paso manual de activar la capacidad compartida y el plan B de tabla única del diseño anterior (API de Table): en NoSQL la capacidad compartida de base de datos se declara en Bicep.

### D4. Contenedores: en Bicep, cada uno en el cambio que lo necesita
| Opción | Trade-off |
|---|---|
| **Bicep** (elegida): cada cambio añade su `sqlDatabases/containers` (id, clave de partición, política de indexación, TTL si aplica) a `infra/`, **sin `options`** (hereda la capacidad compartida) | Se revisa en el PR con `what-if`; compatible con `disableKeyBasedMetadataWriteAccess` (D2b); la app no hace llamadas de metadatos al arrancar (límite de 240 RU/s de metadatos por cuenta). En contra: hay que ejecutar el deploy manual de `infra.yml` **antes** de desplegar la app que usa el contenedor nuevo; y la clave de partición no se puede cambiar después (igual que desde código). |
| Desde el código (`createIfNotExists` al arrancar) | Exige permitir escritura de metadatos con la clave, así que una clave filtrada podría borrar contenedores; cada arranque en frío hace llamadas de metadatos; la estructura no se ve en el `what-if`. |

En las pruebas (emulador de Cosmos en la CI y en local, a partir del cambio 2) el código de pruebas sí crea la base de datos y los contenedores, a partir de **una única lista de definiciones** en `api/` (nombre, clave de partición) que el cambio 2 diseña; una prueba compara esa lista con los contenedores de `infra/main.bicep` para que no se separen.

### D5. Corte automático: grupo de acciones → Logic App de consumo → `publicNetworkAccess = Disabled`
| Opción | Coste en reposo | Trade-off |
|---|---|---|
| **Logic App de consumo** (elegida) | 0 € | Declarable entera en Bicep (definición + acción HTTP con identidad administrada contra ARM). Se paga por acción ejecutada (≈ 0,00002 €/acción integrada, **a verificar** en la tarifa vigente en euros). |
| Runbook de Automation | 0 € (500 min/mes gratis) | El contenido del runbook no se puede declarar inline en Bicep (exige `publishContentLink` a una URL o un paso extra de subida); módulos Az que mantener. |
| Function aparte | No es 0 | Necesita su propio plan y una cuenta de Storage de pago por uso. |
| Bajar las RU/s de la base de datos | — | No ahorra nada (las 1000 RU/s son gratis) y no frena lo que sí puede facturar (almacenamiento > 25 GB). Descartado. |

Qué corta: `PATCH` de la cuenta con `publicNetworkAccess: Disabled` (plano de control). Sigue siendo válido con la API de NoSQL: bloquea todo el tráfico del plano de datos por la red pública, que es la única vía de las Functions gestionadas. Efecto: la app recibe errores al leer o escribir y muestra "servicio no disponible"; **ningún dato se borra**. La identidad de la Logic App tiene el rol **Cosmos DB Operator** solo sobre la cuenta (gestiona la cuenta pero no lee claves ni datos). Descartado rotar la clave: exige permisos `listKeys/regenerateKey` y deja la app con una clave rota distinta de la desplegada.

Solo el aviso **real al 100 %** dispara el corte; el **previsto** al 100 % y los del 50 % solo envían correo (un previsto de 1 € no justifica dejar sin servicio).

Reactivación manual (documentada en `infra/README.md`): revisar la causa en Cost Management y ejecutar `infra.yml` (deploy), que vuelve a poner `publicNetworkAccess: Enabled`; o `az cosmosdb update -n <cuenta> -g <rg> --public-network-access ENABLED`. Como el deploy reactiva, **el deploy es manual** (D7): una fusión cualquiera no reabre el acceso tras un corte.

Límites honestos: los datos de coste de Azure llegan con 8–24 h de retraso y el presupuesto se evalúa con ese retraso, así que el corte es un **respaldo**, no un freno en tiempo real. La protección principal es el tope `totalThroughputLimit = 1000`: con el nivel gratuito, las RU/s no pueden facturar. Lo que podría facturar: > 25 GB de datos, copias de backup extra o activar a mano una función de pago; todo eso lo vigila el presupuesto.

#### Coste del mecanismo de corte (estimado, en euros)
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

### D6. Comprobación previa de nivel gratuito
Solo puede haber una cuenta de Cosmos con nivel gratuito por suscripción y `enableFreeTier` no se puede cambiar tras crear la cuenta. Antes del `what-if` y del deploy, `infra.yml` lista las cuentas de la suscripción (`az cosmosdb list`) y **falla** si hay alguna con `enableFreeTier = true` distinta de la nuestra. Así nunca se crea una cuenta de pago por error.

### D7. Despliegue: OIDC, dos identidades, `what-if` en PR, deploy manual
- `infra.yml`: en PR que tocan `infra/**` → comprobación de nivel gratuito + `az deployment group what-if` (resultado en el resumen del job). En `workflow_dispatch` → comprobación + `az deployment group create`.
- Ambos jobs usan el entorno de GitHub **`infra`**, con Rafa como revisor obligatorio: ningún código de un PR obtiene el token de Azure sin su aprobación. Trade-off: Rafa aprueba también los `what-if` (pocos; solo PR de `infra/**`).
- **Dos identidades administradas asignadas por el usuario** con credencial federada (sin secretos):
  - `id-buenavista-infra` (sujeto `environment:infra`): `Contributor` y `Role Based Access Control Administrator` (con condición: solo puede asignar `Cosmos DB Operator` y `Contributor`) en el grupo; `Reader` en la suscripción.
  - `id-buenavista-app` (sujeto `environment:produccion`, rama `main`): `Contributor` **solo sobre el recurso SWA**, asignado por el Bicep. Solo sirve para leer el token de despliegue.
- Deploy manual frente a "al fusionar": la infraestructura cambia poco, el deploy reactiva Cosmos tras un corte (D5) y Rafa decide cuándo se crean recursos. En contra: puede quedar deriva si se olvida desplegar (también un contenedor nuevo, D4); el `what-if` del PR la hace visible.
- Correo de avisos: secreto del entorno `infra` (`AVISOS_EMAIL`), pasado como parámetro `@secure()`; nunca en el repo.

### D8. `azure-swa.yml` obtiene el token por OIDC
Antes del paso de despliegue: `azure/login` con `id-buenavista-app` y `az staticwebapp secrets list --query properties.apiKey -o tsv`, enmascarado con `::add-mask::` y pasado como `azure_static_web_apps_api_token`. Se elimina el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN`. El workflow solo se dispara en push a `main` (se quita el disparador `pull_request` si lo hubiera): **sin previews de PR**, y además `stagingEnvironmentPolicy: Disabled` en la SWA. Si falta la variable `AZURE_CLIENT_ID_APP`, termina en verde con aviso, como antes sin token.

## Recursos (resumen de propiedades)
- `Microsoft.Web/staticSites` (Free, `westeurope`, `stagingEnvironmentPolicy: Disabled`, `allowConfigFileUpdates: true`) + `config/appsettings` (`COSMOS_CONNECTION`, `COSMOS_DATABASE = buenavista`).
- `Microsoft.DocumentDB/databaseAccounts` (`kind: GlobalDocumentDB`, **sin `capabilities`** (API de NoSQL), `enableFreeTier: true`, `capacity.totalThroughputLimit: 1000`, `consistencyPolicy` `Session`, una `location` con `isZoneRedundant: false`, `enableMultipleWriteLocations: false`, `enableAutomaticFailover: false`, `enableAnalyticalStorage: false`, `backupPolicy` periódica por defecto (cada 240 min, 8 h de retención, redundancia local; dentro de las 2 copias gratuitas), `publicNetworkAccess: Enabled`, `ipRules`, `minimalTlsVersion: Tls12`, `disableKeyBasedMetadataWriteAccess: true`).
- `Microsoft.DocumentDB/databaseAccounts/sqlDatabases` `buenavista` con `options.throughput: 1000` (D3). Sin `containers` en este cambio.
- `Microsoft.Logic/workflows` (consumo, identidad asignada por el sistema) + asignación de `Cosmos DB Operator` sobre la cuenta.
- `Microsoft.Insights/actionGroups` (región `global`, `logicAppReceivers` con `useCommonAlertSchema: true`).
- `Microsoft.Consumption/budgets` (importe `1`, en la moneda de facturación: **euros**; `Monthly`, `startDate` fija en el `.bicepparam`; notificaciones `Actual` 50/100 y `Forecasted` 50/100; `contactGroups` solo en `Actual` 100).
- Sin `outputs` con secretos.
- Región de Cosmos: parámetro, por defecto `westeurope`; si la región no admite cuentas nuevas por capacidad, `northeurope` o `spaincentral` (UE). Las Functions gestionadas corren en la región de la SWA.

## Riesgos
- El corte llega con retraso (D5); mitigado por el tope de RU/s.
- Con la clave filtrada, alguien desde Azure puede leer y escribir datos (no crear ni borrar contenedores, ni facturar RU/s). Mitigación: rotación documentada.
- Un contenedor nuevo exige desplegar `infra.yml` antes que la app (D4); el `README` y la checklist de cada cambio lo recuerdan.
- Si el proyecto necesitara más de 25 contenedores, haría falta otra base de datos (≥ 400 RU/s, fuera del tope): se revisaría el modelo antes.

## Preguntas abiertas
Ninguna para Rafa. Quedan las verificaciones de las tareas 2.4 (`ipRules` con las Functions gestionadas) y 2.5 (rol `Cosmos DB Operator` y tarifas en euros).
