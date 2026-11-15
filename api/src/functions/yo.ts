import { app } from '@azure/functions';
import { depsIdentidad } from '../identidad';
import { respuestaYo } from '../yo';

// No pública: identifica en cada petición (identidad.ts).
app.http('yo', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'yo',
  handler: (request, context) => respuestaYo(request.headers, depsIdentidad((mensaje) => context.error(mensaje))),
});
