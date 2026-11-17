import { app } from '@azure/functions';
import { respuestaReubicar } from '../farolas-http';
import { RepositorioFarolas } from '../farolas-repo';
import { depsIdentidad } from '../identidad';
import { tablaClient } from '../tablas';

// Reubicar (specs/008-reubicar-farola): no público, solo directiva; identifica en cada petición.
app.http('farola-reubicar', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'farolas/{id}',
  handler: (request, context) => {
    const registrarError = (mensaje: string) => context.error(mensaje);
    return respuestaReubicar(request.params.id, request.headers, () => request.json(), depsIdentidad(registrarError), {
      farolas: () => new RepositorioFarolas(tablaClient('Farolas'), tablaClient('Auditoria')),
      registrarError,
    });
  },
});
