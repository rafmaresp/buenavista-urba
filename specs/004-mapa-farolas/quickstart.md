# Quickstart: validar el mapa de farolas

## Tests

```bash
cd web && npm ci && npm test && npm run build
cd ../api && npm ci && npm run build
cp local.settings.sample.json local.settings.json
cd ../e2e && npm ci && npx playwright install chromium && npm test
```

Esperado: unitarios en verde; e2e `mapa.spec.ts` en verde en los proyectos `escritorio` y `movil` (70 marcas, ficha de F01, cambio de capa, aviso de error y reintento). Capturas en `e2e/test-results/`.

## A mano, tras desplegar

1. Abrir la URL de la SWA en el móvil sin iniciar sesión.
2. Ver la ortofoto centrada en Buenavista I con 70 puntos; acercar y ver los códigos.
3. Tocar una farola: ficha con código y calle.
4. Cambiar a "Callejero" y volver.
5. Consola del navegador sin errores de CSP.
