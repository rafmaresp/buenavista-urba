import { app } from '@azure/functions';

// Configuración pública para el front (el client ID de Google no es secreto).
app.http('Config', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'config',
  handler: async () => ({ jsonBody: { googleClientId: process.env['GOOGLE_CLIENT_ID'] ?? null } }),
});
