# Quickstart: Gestión de usuarios por la directiva

## Pruebas automáticas

```bash
cd api && npm ci && npm run build && npm test     # unitarias; integración si hay Azurite (TABLES_CONNECTION…)
cd web && npm ci && npm run build && npm test
cd e2e && npm ci && npx playwright install chromium && npm test -- tests/usuarios.spec.ts
```

Esperado: verde; en `api/`, las de `usuarios-http`, `usuarios-repo` (alta/cambio auditados y deshechos) y la integración con el SAS `raud`.

## Validación manual (tras desplegar; requiere aprobar el despliegue de infra por el cambio de SAS)

1. Entrar con una cuenta de directiva → aparece "Usuarios" en la cabecera.
2. Dar de alta un correo de prueba como comunero → aparece activo y "sin entrar"; esa cuenta entra.
3. Dar de baja esa cuenta → su siguiente acción con sesión responde "sin acceso". Reactivar → vuelve a entrar.
4. Cambiarla a directiva → al volver a entrar ve "Usuarios".
5. En la fila propia no hay botones de rol ni baja.
6. Entrar como comunero y abrir `/usuarios` → "Solo la directiva…"; la API responde 403.
