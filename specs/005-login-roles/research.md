# Research: Login con Google y roles

## 1. Sesión: token por petición frente a sesión propia
- **Decision**: sin sesión en servidor. La web guarda el ID token de Google en memoria y lo envía en cada petición; cada Function lo valida.
- **Rationale**: lo exigen la constitución IV, `docs/producto.md` y la propuesta RGPD ("ID token validado en cada Function y no almacenado"). Evita cookies, tabla de sesiones y CSRF.
- **Alternatives**: cookie de sesión firmada propia (más superficie: clave que rotar, CSRF, otra escritura por login); auth de SWA (descartada en la constitución).
- **Coste para el usuario**: el token dura 1 h y se pierde al recargar; vuelve a `/login`, donde GIS reentra con un toque.

## 2. Cabecera del token
- **Decision**: `X-Id-Token: <jwt>`.
- **Rationale**: hay informes de que SWA sustituye o elimina la cabecera `Authorization` hacia la API gestionada ([Auth0 community](https://community.auth0.com/t/azure-static-website-api-overrides-the-bearer-attribute-in-the-header/48942), [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5658836/static-web-app-with-managed-function-cant-turn-off)). No verificado en nuestra SWA; una cabecera propia evita el riesgo.
- **Alternatives**: `Authorization: Bearer` (estándar, pero riesgo anterior).

## 3. Validación del token
- **Decision**: `OAuth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })` (firma con las claves públicas de Google, cacheadas por la librería; `iss` ∈ {accounts.google.com, https://accounts.google.com}; `exp`). Después se exige `email_verified === true`.
- **Alternatives**: `jose` + JWKS a mano (más código, misma seguridad).

## 4. Búsqueda del usuario
- **Decision**: partición única `usuario`, `rowKey = uid`. Búsqueda por `sub` y, si no hay, por `email` con filtro `odata` dentro de la partición.
- **Rationale**: ~200 filas; un escaneo de partición cuesta 1 transacción. Índices secundarios (filas por email/sub) duplicarían datos personales y complicarían la supresión.

## 5. Vinculación del `sub`
- **Decision**: `updateEntity(..., 'Merge', { etag })` con `sub`; auditoría `usuario.vincular` (actor y clave = uid; antes `{vinculado:false}`, después `{vinculado:true}`); si la auditoría falla, se vuelve a poner `sub` vacío; si eso también falla, `VinculacionSinAuditar`.
- **Rationale**: mismo patrón que `RepositorioFarolas`; ETag evita carreras de dos primeros logins.
- **SAS**: `Usuarios` con `ru` (leer y actualizar). Altas y bajas (cambio siguiente) irán con la identidad de infra, no con la app.

## 6. Límite de peticiones
- **Decision**: ventana fija de 60 s, 60 peticiones por uid, en memoria de la instancia; 429 con `Retry-After`.
- **Alternatives**: contador en Table Storage (una escritura por petición: más coste que lo que protege).

## 7. Client ID de Google
- **Decision**: parámetro `googleClientId` en `infra/main.bicepparam` (es público: aparece en la página) → app setting `GOOGLE_CLIENT_ID`; la web lo pide a `GET /api/config`.
- **Rationale**: una sola fuente para la audiencia de la API y el botón de la web.
- **Alternatives**: incrustarlo en el bundle de Angular (dos fuentes que pueden divergir).

## 8. CSP
- **Decision**: añadir `https://accounts.google.com/gsi/client` a `script-src`, `https://accounts.google.com` a `frame-src` y `connect-src`, y `https://accounts.google.com/gsi/style` a `style-src`, según la guía de GIS. El hilo del mapa también amplía la CSP: quien fusione segundo une ambas.

## 9. Usuarios de prueba
- **Decision**: no en este cambio. Las pruebas de identidad usan un verificador falso inyectado (unitarias e integración). El e2e cubre `/login`, `/privacidad` y el 401. Los usuarios de prueba del e2e llegan con el cambio 5, que los necesita para reportar.
- **Rationale**: no introducir en el código de producción un modo que acepte tokens falsos.
