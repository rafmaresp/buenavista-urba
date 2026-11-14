# Tareas — pagina-acerca-de

> Se implementan solo tras `@claude implementa` en el PR y con los cambios 2 y 4 fusionados.

## 1. Preparación
- [ ] 1.1 Confirmar que `login-roles` (4) y `catalogo-farolas` (2) están fusionados y resolver las preguntas abiertas de `spec.md`

## 2. Infraestructura
- [ ] 2.1 Añadir la tabla `Contenido` a `infra/main.bicep` y a la lista única de nombres de tablas de `api/`
- [ ] 2.2 Test que compara esa lista con `infra/`

## 3. API
- [ ] 3.1 Texto por defecto versionado y `GET /api/acerca` anónimo con `Cache-Control`
- [ ] 3.2 `PUT /api/acerca`: autenticación, rol directiva, validación, escritura y `auditar()` con `{longitud}`
- [ ] 3.3 Tests de integración contra Azurite (casos del plan)
- [ ] 3.4 Pasar `revisar-seguridad`

## 4. Web
- [ ] 4.1 Ruta `/acerca-de` pública y enlace en el menú
- [ ] 4.2 Vista con texto escapado, error de carga con texto por defecto
- [ ] 4.3 Editor para directiva (`textarea`, contador, aviso de datos personales)
- [ ] 4.4 Tests de componente con Vitest

## 5. Cierre
- [ ] 5.1 `npm run build` y `npm test` en verde en `web/` y `api/`
- [ ] 5.2 `speckit-converge` hasta `Converged`
