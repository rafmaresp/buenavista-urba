import { app } from '@azure/functions';
import { depsIdentidad } from '../identidad';
import { tablaClient } from '../tablas';
import { type DepsGestionUsuarios, respuestaAlta, respuestaCambiar, respuestaListar } from '../usuarios-http';
import { RepositorioUsuarios } from '../usuarios-repo';

// Gestión de la lista cerrada (specs/010-gestion-usuarios): no pública, solo directiva; identifica en cada petición.
function deps(registrarError: (mensaje: string) => void): DepsGestionUsuarios {
  return {
    usuarios: () => new RepositorioUsuarios(tablaClient('Usuarios'), tablaClient('Auditoria')),
    registrarError,
  };
}

app.http('usuarios', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'usuarios',
  handler: (request, context) => {
    const registrarError = (mensaje: string) => context.error(mensaje);
    const identidad = depsIdentidad(registrarError);
    if (request.method === 'GET') return respuestaListar(request.headers, identidad, deps(registrarError));
    return respuestaAlta(request.headers, () => request.json(), identidad, deps(registrarError));
  },
});

app.http('usuario-cambiar', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'usuarios/{uid}',
  handler: (request, context) => {
    const registrarError = (mensaje: string) => context.error(mensaje);
    return respuestaCambiar(request.params.uid, request.headers, () => request.json(), depsIdentidad(registrarError), deps(registrarError));
  },
});
