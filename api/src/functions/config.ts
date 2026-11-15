import { app } from '@azure/functions';
import { respuestaConfig } from '../config';

// Pública por diseño: solo el client ID de Google, que aparece en la página de login.
app.http('config', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'config',
  handler: () => respuestaConfig(),
});
