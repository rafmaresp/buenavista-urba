# Quickstart: Alta de usuarios en la lista cerrada

## Local (Azurite)

1. `cd api && npm ci && npm run build`
2. Arranca Azurite (`azurite-table --inMemoryPersistence`) y define `TABLES_CONNECTION` como en la CI.
3. `npm test`: las unitarias cubren validación, carga, auditoría y deshacer; `carga-usuarios.integration.test.ts` da de alta contra Azurite con SAS `rad`/`a`, relanza (0 altas) y comprueba que la auditoría no lleva correos.

## Entorno real

1. Rafa crea el secreto `USUARIOS_ALTA` en GitHub → Settings → Environments → `infra` con `su-correo,directiva`.
2. Fusiona el PR (toca `infra-desplegar.yml`, así que el push a main despliega la infra) y aprueba el entorno `infra`.
3. El resumen del job muestra "Carga de usuarios" con `Altas: 1`.
4. Rafa entra en `/login` con esa cuenta (añadida como usuario de prueba en Google Auth Platform si el cliente sigue en Testing) y ve el rol directiva.
5. Relanzar "Desplegar infraestructura (Bicep)" a mano da `Altas: 0`.
