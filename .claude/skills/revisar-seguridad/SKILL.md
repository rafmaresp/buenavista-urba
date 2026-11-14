---
name: revisar-seguridad
description: Criterios de seguridad y privacidad de Buenavista I. Úsala al diseñar, implementar o revisar cualquier cambio en api/, en el login, en datos, en infra/ o en workflows, y siempre antes de dar por terminada una Function.
---

# Revisar seguridad y privacidad

Comprueba cada punto que aplique al cambio. Para cada fallo, indica archivo y línea, el escenario concreto que lo explota y la corrección. No señales riesgos teóricos que el código no tiene.

Referencias: principios II, III y IV de `.specify/memory/constitution.md`, roles en `docs/producto.md` y `docs/rgpd/propuesta-rgpd-v1.md`.

## 1. Identidad (cada Function, sin excepción)

- Toda Function que no sea pública por diseño (`GET /api/farolas`, `GET /api/health`) valida el ID token de Google con `google-auth-library` (`verifyIdToken`) en esa misma petición. No vale confiar en un token validado antes, en una cookie propia ni en cabeceras de SWA (`x-ms-client-principal`): no se usa la auth de SWA.
- Se comprueba `audience` = client ID propio, `iss` de Google, caducidad y `email_verified === true`.
- La validación vive en un único helper compartido y todas las Functions lo usan. Una Function nueva que no lo llama es un fallo.
- Un token ausente, caducado o inválido devuelve 401; un usuario fuera de la lista cerrada o con `estado` distinto de `activo`, 403 genérico. La respuesta no dice si el email existe.

## 2. Autorización en el servidor

- El rol (`comunero` o `directiva`) se lee del contenedor `Usuarios` en cada petición, nunca del cliente (cuerpo, query, cabecera ni claims que manda Angular).
- Las acciones de directiva (cambiar estado, ver todas las incidencias, ver precisión, reubicar farolas, ocultar comentarios, capa de redes) comprueban `rol === 'directiva'` en la Function. Ocultar un botón en Angular no protege nada.
- Las transiciones de estado se validan en servidor (solo hacia delante, sin reabrir Completado salvo que la spec diga otra cosa).
- Busca IDOR: si un comunero manda el id de otro recurso, ¿lo puede leer o cambiar?

## 3. Qué devuelve la API

- Visitante y comunero no reciben nunca el autor (`uid`), el email, el `sub` ni la precisión de las farolas. El comentario, solo la directiva y su autor.
- Los votos devuelven recuento y "has votado", nunca quién votó.
- Revisa los DTO de respuesta campo a campo: un `...entidad` que devuelve el documento entero de Cosmos es un fallo.

## 4. Datos personales (RGPD)

- Datos mínimos: no añadas campos personales que la spec no pida.
- Nada de email, `sub`, tokens, cabecera `Authorization`, nombre ni cuerpos de petición en logs (`context.log`, `console.*`), errores devueltos, auditoría, fixtures, tests ni commits. Usa emails de ejemplo con dominio `example.com` solo si son inevitables.
- La auditoría guarda `actor` = `uid`, `sistema:*` o `dev:<alias>`. El texto del comentario se audita como `{presente, longitud}`.
- Cada escritura genera su entrada de auditoría en la misma operación; si la auditoría falla, la escritura no se hace.

## 5. Entrada y escrituras

- Valida tipo, longitud (comentario ≤ 280) y valores permitidos en servidor. Rechaza campos desconocidos en lugar de guardarlos.
- Consultas a Cosmos siempre parametrizadas; nada de concatenar entrada del usuario en SQL.
- Los duplicados se impiden con escritura condicional (ETag o clave única), no con "leer y luego escribir".
- Límite de peticiones por usuario en las escrituras.

## 6. Capa restringida de redes (tuberías y cables)

- Solo la directiva. Ni la geometría ni los metadatos salen por un endpoint anónimo, por la caché de la CDN (`Cache-Control: private, no-store`) ni como fichero estático en `web/public/` o en el bundle de Angular.
- Los datos fuente no se suben al repo si no los ha aprobado Rafa.

## 7. Front (Angular)

- Sin `innerHTML` ni `bypassSecurityTrust*` con datos del usuario.
- El ID token se guarda en memoria, no en `localStorage`.
- La CSP de `web/public/staticwebapp.config.json` no se relaja (`unsafe-inline`, `unsafe-eval`, comodines) sin justificarlo en el PR.

## 8. Infraestructura, workflows y secretos

- Sin secretos ni connection strings en el repo; OIDC para Azure.
- Workflows: permisos mínimos por job, Actions fijadas por SHA, nada de `pull_request_target` con checkout del código del PR, y ningún `${{ github.event.* }}` con texto de usuario (títulos, cuerpos, comentarios) interpolado dentro de un `run:`.
- Ningún recurso de Azure de pago ni fuera de la UE, y ninguno sin el presupuesto con corte automático.
