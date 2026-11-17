# Quickstart: Reubicar farola (directiva)

## API

```bash
cd api && npm ci && npm run build && npm test
```

Con Azurite (como en la CI: `TABLES_CONNECTION`, `TABLES_ACCOUNT_NAME`, `TABLES_ACCOUNT_KEY`), `farolas-reubicar.integration.test.ts` comprueba con el SAS `ru` de la app que:

- reubicar cambia lat, lon y precisión y deja una entrada `farola.reubicacion` con antes y después;
- con un ETag antiguo la segunda reubicación da `FarolaCambiada` y no pisa la primera;
- si la auditoría falla (SAS de `Auditoria` sin `a`), la farola vuelve a su posición.

## Web

```bash
cd web && npm ci && npm run build && npm test
```

## e2e

```bash
cd e2e && npm ci && npx playwright install chromium && npm test -- reubicar
```

Esperado: con una sesión de directiva simulada, "Mover" en la ficha de F07, arrastrar, "¿Mover F07 aquí?", Guardar envía `PUT /api/farolas/F07` y la marca se queda; Cancelar la devuelve. El `PUT` real sin token responde 401.

## En Azure (tras fusionar)

El despliegue pide aprobar `infra` (cambia el SAS de `Farolas`). Después, con una cuenta de directiva: mover una farola, recargar pasados 5 minutos y verla en la nueva posición.
