## MODIFIED Requirements

### Requirement: Despliegue en Static Web Apps Free
El despliegue SHALL publicar `web/` y `api/` en una Azure Static Web App de plan Free con API gestionada (`apiRuntime: node:22`) en cada push a `main`, obteniendo el token de despliegue de la SWA en el propio workflow mediante identidad federada (OIDC). El workflow MUST NOT ejecutarse en `pull_request` ni crear entornos de preview, y MUST NOT depender de un secreto con el token copiado a mano. Si no existe la variable `AZURE_CLIENT_ID_APP`, el workflow MUST terminar sin error y con un aviso, sin desplegar.

#### Scenario: Push a main con identidad configurada
- **WHEN** se fusiona un PR en `main` y la identidad de despliegue está configurada
- **THEN** el workflow obtiene el token por OIDC sin mostrarlo en el log, despliega la web y la API, y `GET /api/health` responde `200` en la URL de la SWA

#### Scenario: Sin identidad configurada
- **WHEN** se hace push a `main` y la variable `AZURE_CLIENT_ID_APP` no existe
- **THEN** el workflow termina en verde con el aviso de despliegue omitido

#### Scenario: Pull request
- **WHEN** se abre o actualiza un pull request
- **THEN** el workflow de despliegue no se ejecuta y no se crea ningún entorno de preview

#### Scenario: Recarga en una ruta
- **WHEN** el navegador pide una ruta de la SPA que no es un fichero
- **THEN** SWA sirve `index.html`
