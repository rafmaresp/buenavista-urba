# Quickstart: validar el catálogo de farolas

## En la CI (cada PR)

Job `api` (Azurite ya arrancado): `npm ci && npm run build && npm test` en `api/`. Debe pasar:

- parseo de la semilla: 70 farolas, F62 incluida;
- `auditar()`: actores válidos e inválidos, campos prohibidos, clave `AAAA-MM`;
- `GET /api/farolas`: sin precisión, ordenado, caché 5 min, error genérico sin caché;
- integración: carga en vacío → 70 farolas y 70 entradas; segunda carga → 0 cambios; farola existente no se toca; SAS de app (`Farolas: r`, `Auditoria: ra`) no escribe farolas ni modifica o borra auditoría; tablas del código = tablas del Bicep.

## En Azure (tras fusionar)

Desde el despliegue continuo (registro, 2026-11-15) no hay pasos manuales: el push a `main` ejecuta infraestructura (crea `Farolas` y `Auditoria` y sustituye `TABLES_CONNECTION` por `FAROLAS_CONNECTION` y `AUDITORIA_CONNECTION`), carga (el resumen de la primera vez dice "Altas: 70"; las siguientes, "Altas: 0") y app. Después, abrir `https://<swa>/api/farolas`: 70 farolas, sin `precision`, cabecera `Cache-Control: public, max-age=300`. Esto verifica también que el SAS de servicio permite consultar entidades en Azure.
