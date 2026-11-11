## ADDED Requirements

### Requirement: Estructura del repositorio
El repositorio SHALL contener `web/` (Angular) y `api/` (Azure Functions modelo v4, Node 22, TypeScript), cada uno con su `package-lock.json` versionado. El repositorio MUST NOT contener proyectos .NET.

#### Scenario: Instalación reproducible
- **WHEN** se ejecuta `npm ci` en `web/` o en `api/`
- **THEN** la instalación usa exactamente las versiones del lockfile y termina sin error

### Requirement: Endpoint de salud
La API SHALL exponer `GET /api/health`, anónimo, que responde `200` con cuerpo `{"estado":"ok"}` y cabecera `Cache-Control: no-store`, sin acceder a almacenamiento ni revelar versión o configuración.

#### Scenario: Comprobación de salud
- **WHEN** se hace `GET /api/health`
- **THEN** la respuesta es `200`, `{"estado":"ok"}` y `Cache-Control: no-store`

#### Scenario: Método no soportado
- **WHEN** se hace `POST /api/health`
- **THEN** la respuesta no es `200`

### Requirement: Integración continua
La CI SHALL ejecutarse en cada pull request y en cada push a `main`, y MUST fallar si falla el build o los tests de `web/` o de `api/`. Los workflows MUST usar permisos mínimos (`contents: read` salvo el despliegue).

#### Scenario: PR con test roto
- **WHEN** un PR rompe un test de `api/`
- **THEN** el job `api` de la CI falla

### Requirement: Despliegue en Static Web Apps Free
El despliegue SHALL publicar `web/` y `api/` en una Azure Static Web App de plan Free con API gestionada (`apiRuntime: node:22`) en cada push a `main`. Si no existe el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN`, el workflow MUST terminar sin error y con un aviso, sin desplegar.

#### Scenario: Push a main con token
- **WHEN** se fusiona un PR en `main` y el secreto existe
- **THEN** se despliegan la web y la API, y `GET /api/health` responde `200` en la URL de la SWA

#### Scenario: Sin token
- **WHEN** se hace push a `main` y el secreto no existe
- **THEN** el workflow termina en verde con el aviso de despliegue omitido

#### Scenario: Recarga en una ruta
- **WHEN** el navegador pide una ruta de la SPA que no es un fichero
- **THEN** SWA sirve `index.html`

### Requirement: Coste y privacidad de la base
La plataforma MUST NOT crear ni requerir recursos de Azure de pago (incluidos Storage y Application Insights) en este cambio. La web MUST NOT usar cookies, analítica ni recursos de terceros, y SHALL enviar `Content-Security-Policy` con `default-src 'self'`, `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin`.

#### Scenario: Cabeceras de seguridad
- **WHEN** se pide `index.html` a la SWA desplegada
- **THEN** la respuesta incluye las tres cabeceras con esos valores

#### Scenario: Sin rastreo
- **WHEN** un vecino abre la web
- **THEN** no se establece ninguna cookie y no se hace ninguna petición a dominios distintos del propio
