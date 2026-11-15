using './main.bicep'

// Sin datos personales: el correo y el GUID del rol llegan por variables de entorno desde infra.yml.
param location = 'spaincentral'
param swaLocation = 'westeurope'
param presupuestoInicio = '2026-11-01'
param avisosEmail = readEnvironmentVariable('AVISOS_EMAIL')
param corteRoleId = readEnvironmentVariable('CORTE_ROLE_ID')
