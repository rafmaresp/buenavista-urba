# Quickstart: validar el aviso de mantenimiento

Requisitos previos: cambios 2, 3 y 4 implementados; Azurite y Azure Functions Core Tools; usuarios de prueba solo en Azurite.

1. `cd api && npm ci && npm test` → tests unitarios y de integración del aviso en verde.
2. `cd web && npm ci && npm test` → tests del banner y del formulario en verde.
3. Arrancar API y web en local (`npm start` en cada una) con Azurite.
4. Como visitante: `GET /api/aviso` devuelve 204 y el mapa no muestra banner.
5. Como directiva: publicar un aviso con fecha futura → el mapa lo muestra a un visitante anónimo en ≤ 1 min.
6. Como comunero o sin sesión: `PUT` y `DELETE` devuelven 401/403 y no cambian nada.
7. Quitar el aviso como directiva → desaparece el banner; comprobar la entrada en `Auditoria` sin el texto.
8. Con un aviso cuya fecha ya pasó, `GET` devuelve 204.

Contrato: [contracts/aviso.openapi.yaml](contracts/aviso.openapi.yaml). Datos: [data-model.md](data-model.md).
