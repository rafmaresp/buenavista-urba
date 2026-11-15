import { app } from '@azure/functions';
import { PARTICION_FAROLAS } from '../farolas';
import { depsIdentidad } from '../identidad';
import { type DepsIncidencias, respuestaCambiarEstado, respuestaCrear, respuestaListar } from '../incidencias-http';
import { RepositorioIncidencias } from '../incidencias-repo';
import { tablaClient } from '../tablas';

function deps(registrarError: (mensaje: string) => void): DepsIncidencias {
  return {
    incidencias: () => new RepositorioIncidencias(tablaClient('Incidencias'), tablaClient('Auditoria')),
    farolaExiste: async (id) => {
      try {
        await tablaClient('Farolas').getEntity(PARTICION_FAROLAS, id, { queryOptions: { select: ['RowKey'] } });
        return true;
      } catch (e) {
        if ((e as { statusCode?: number }).statusCode === 404) return false;
        throw e;
      }
    },
    registrarError,
  };
}

// GET anónimo (docs/producto.md: el visitante ve las abiertas sin autor ni comentario).
// POST no público: identifica en cada petición (identidad.ts).
app.http('incidencias', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'incidencias',
  handler: (request, context) => {
    const registrarError = (mensaje: string) => context.error(mensaje);
    if (request.method === 'GET') return respuestaListar(deps(registrarError));
    return respuestaCrear(request.headers, () => request.json(), depsIdentidad(registrarError), deps(registrarError));
  },
});

// PUT no público y solo directiva (spec 008): el rol se comprueba en respuestaCambiarEstado().
app.http('incidencias-estado', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'incidencias/{id}',
  handler: (request, context) => {
    const registrarError = (mensaje: string) => context.error(mensaje);
    return respuestaCambiarEstado(
      request.headers,
      request.params.id,
      () => request.json(),
      depsIdentidad(registrarError),
      deps(registrarError),
    );
  },
});
