## ADDED Requirements

### Requirement: Infraestructura como código
Todos los recursos de Azure del proyecto SHALL declararse en `infra/` con Bicep y desplegarse en un único grupo de recursos en una región de la UE. El repositorio MUST NOT contener secretos, claves ni datos personales (incluido el correo de avisos).

#### Scenario: Despliegue reproducible
- **WHEN** se despliega `infra/main.bicep` dos veces seguidas con los mismos parámetros
- **THEN** el segundo `what-if` no muestra cambios

#### Scenario: Sin secretos en el repositorio
- **WHEN** se revisan `infra/` y los workflows
- **THEN** no aparece ninguna clave, cadena de conexión, token ni dirección de correo

### Requirement: Static Web App Free sin previews
La infraestructura SHALL crear una Static Web App de plan Free con los entornos de staging desactivados y con la cadena de conexión de Cosmos como app setting, obtenida durante el despliegue.

#### Scenario: App setting de datos
- **WHEN** termina el despliegue
- **THEN** la SWA tiene los app settings `COSMOS_CONNECTION` y `COSMOS_DATABASE` y el valor de la cadena de conexión no aparece en ningún output ni log del workflow

#### Scenario: Sin entornos de preview
- **WHEN** se abre un pull request
- **THEN** no se crea ningún entorno de staging en la SWA

### Requirement: Cosmos DB for NoSQL gratuito y con tope
La cuenta de Cosmos DB SHALL usar la API de NoSQL, el nivel gratuito (`enableFreeTier: true`) y el tope de cuenta `totalThroughputLimit: 1000`, en una sola región UE, con backup periódico por defecto, TLS mínimo 1.2 y escritura de metadatos con clave desactivada. La cuenta MUST NOT tener multirregión, escrituras multirregión, backup continuo ni almacén analítico.

#### Scenario: Propiedades de coste
- **WHEN** se inspecciona la cuenta desplegada
- **THEN** `enableFreeTier` es `true`, `capacity.totalThroughputLimit` es `1000`, `capabilities` no incluye `EnableTable`, hay una sola ubicación y el backup es periódico

#### Scenario: Abuso de peticiones
- **WHEN** las peticiones superan 1000 RU/s
- **THEN** Cosmos responde 429 y no se factura capacidad adicional

### Requirement: Base de datos con capacidad compartida
La infraestructura SHALL crear una base de datos `buenavista` con 1000 RU/s manuales compartidas (`options.throughput: 1000`). Los contenedores SHALL declararse en `infra/` en el cambio que los necesite, sin RU/s dedicadas, y MUST NOT superar 25 en la base de datos. Este cambio MUST NOT crear contenedores.

#### Scenario: Capacidad compartida
- **WHEN** termina el despliegue
- **THEN** la base de datos `buenavista` tiene 1000 RU/s manuales, o el workflow falla con un mensaje que lo indica

#### Scenario: Contenedor con RU/s dedicadas
- **WHEN** un cambio declara un contenedor con `options.throughput` o `options.autoscaleSettings`
- **THEN** el despliegue falla porque la cuenta supera `totalThroughputLimit`, y la comprobación posterior al deploy también lo rechaza

#### Scenario: Crear contenedores con la clave
- **WHEN** alguien intenta crear o borrar un contenedor con la clave de la cuenta
- **THEN** Cosmos rechaza la operación de metadatos

### Requirement: Acceso restringido a los datos
La cuenta de Cosmos SHALL aceptar conexiones solo desde centros de datos de Azure, más las IP de devs pasadas explícitamente como parámetro. La clave de la cuenta MUST vivir solo en los app settings de la SWA.

#### Scenario: Conexión desde Internet doméstico
- **WHEN** alguien con la cadena de conexión intenta acceder desde una IP fuera de Azure no listada
- **THEN** Cosmos rechaza la conexión

#### Scenario: Conexión desde la API
- **WHEN** una Function gestionada de la SWA lee un contenedor
- **THEN** la lectura funciona

### Requirement: Comprobación de nivel gratuito
Antes de cada `what-if` o despliegue, el workflow MUST comprobar que ninguna otra cuenta de Cosmos de la suscripción usa el nivel gratuito y MUST fallar sin desplegar si alguna lo usa.

#### Scenario: Otra cuenta gratuita en la suscripción
- **WHEN** existe en la suscripción otra cuenta de Cosmos con `enableFreeTier: true`
- **THEN** el workflow falla antes de desplegar y no se crea ninguna cuenta

#### Scenario: Redespliegue de la propia cuenta
- **WHEN** la única cuenta gratuita es la del proyecto
- **THEN** la comprobación pasa

### Requirement: Presupuesto con avisos
La infraestructura SHALL crear un presupuesto mensual de 1 € (la facturación es en euros) sobre el grupo de recursos con avisos por correo al 50 % y al 100 %, tanto de coste real como previsto. El destinatario MUST ser un parámetro seguro del despliegue.

#### Scenario: Aviso al 50 %
- **WHEN** el coste real del mes alcanza el 50 % del presupuesto
- **THEN** se envía un correo al destinatario configurado y no se corta nada

#### Scenario: Previsión al 100 %
- **WHEN** el coste previsto del mes alcanza el 100 %
- **THEN** se envía un correo y no se corta nada

### Requirement: Corte automático sin pérdida de datos
Al alcanzar el 100 % del coste real, un mecanismo automático SHALL desactivar el acceso de red público de la cuenta de Cosmos. El corte MUST NOT borrar datos ni recursos, MUST ejecutarse con una identidad que no pueda leer las claves, y la reactivación SHALL ser manual y estar documentada. El mecanismo MUST NOT tener coste en reposo.

#### Scenario: Presupuesto agotado
- **WHEN** el coste real del mes alcanza el 100 %
- **THEN** la cuenta pasa a `publicNetworkAccess: Disabled`, la API deja de acceder a los datos y los contenedores conservan todos sus documentos

#### Scenario: Invocación no válida
- **WHEN** el mecanismo de corte recibe una petición que no es una alerta de presupuesto
- **THEN** no modifica la cuenta

#### Scenario: Reactivación
- **WHEN** Rafa ejecuta el deploy manual de `infra.yml` tras revisar la causa
- **THEN** la cuenta vuelve a `publicNetworkAccess: Enabled` y la API recupera el acceso

### Requirement: Despliegue de infraestructura con OIDC
El workflow `infra.yml` SHALL autenticarse en Azure con identidad federada (OIDC), sin secretos de larga duración, ejecutar `what-if` en los pull request que modifican `infra/**` y desplegar solo bajo ejecución manual. Ambos jobs MUST usar un entorno de GitHub con aprobación obligatoria de Rafa.

#### Scenario: PR que toca la infraestructura
- **WHEN** se abre un PR que modifica `infra/main.bicep`
- **THEN** tras la aprobación del entorno, el job publica el resultado del `what-if` y no despliega nada

#### Scenario: Fusión en main
- **WHEN** se fusiona en `main` un PR que modifica `infra/**`
- **THEN** no se despliega la infraestructura hasta que alguien lanza el workflow a mano
