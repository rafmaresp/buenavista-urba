# Quickstart: validar el catálogo de farolas

## En la CI (cada PR)

Job `api` (Azurite ya arrancado): `npm ci && npm run build && npm test` en `api/`. Debe pasar:

- parseo de la semilla: 70 farolas, F62 incluida;
- `auditar()`: actores válidos e inválidos, campos prohibidos, clave `AAAA-MM`;
- `GET /api/farolas`: sin precisión, ordenado, caché 5 min, error genérico sin caché;
- integración: carga en vacío → 70 farolas y 70 entradas; segunda carga → 0 cambios; farola existente no se toca; SAS de app (`Farolas: r`, `Auditoria: ra`) no escribe farolas ni modifica o borra auditoría; tablas del código = tablas del Bicep.

## En Azure (Rafa, tras fusionar)

1. **Infraestructura (Bicep)** → *Run workflow* en `main` → aprobar `infra`. Crea `Farolas` y `Auditoria` y sustituye `TABLES_CONNECTION` por `FAROLAS_CONNECTION` y `AUDITORIA_CONNECTION`.
2. **Cargar farolas** → *Run workflow* en `main` → aprobar `infra`. El resumen debe decir "70 altas". Relanzarlo debe decir "0 altas".
3. **Despliegue Azure Static Web Apps** (se lanza solo al fusionar; si ya corrió antes del paso 1, relánzalo). Abrir `https://<swa>/api/farolas`: 70 farolas, sin `precision`, cabecera `Cache-Control: public, max-age=300`. Esto verifica también que el SAS de servicio permite consultar entidades en Azure.
