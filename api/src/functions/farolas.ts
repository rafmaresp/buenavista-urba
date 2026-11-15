import { app } from '@azure/functions';
import { respuestaFarolas } from '../farolas';
import { tablaClient } from '../tablas';

// Anónimo y cacheable (docs/producto.md): el mapa de farolas es público.
app.http('farolas', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'farolas',
  handler: (_request, context) =>
    respuestaFarolas(
      () => tablaClient('Farolas'),
      (mensaje) => context.error(mensaje),
    ),
});
