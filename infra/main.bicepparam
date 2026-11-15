using './main.bicep'

// Sin datos personales: el correo y el GUID del rol llegan por variables de entorno desde infra.yml.
param location = 'spaincentral'
// PROVISIONAL (decisión 2026-11-15): westeurope cerrada a la suscripción; solo pruebas, sin datos reales.
param swaLocation = 'eastus2'
param presupuestoInicio = '2026-11-01'
param avisosEmail = readEnvironmentVariable('AVISOS_EMAIL')
param corteRoleId = readEnvironmentVariable('CORTE_ROLE_ID')
// Público (no es secreto). Lo crea Rafa en Google Cloud (infra/README.md); vacío = login no disponible.
param googleClientId = '115994210583-2n2hg02kal7k1l1n4qop3m262sh83fpr.apps.googleusercontent.com'
