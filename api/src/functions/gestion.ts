import { app } from '@azure/functions';
import { esAdmin } from '../lib/auth';
import { ESTADOS, Estado, aGestion } from '../lib/modelos';
import { modificar, todas } from '../lib/repo';

// Endpoints de la junta: exigen ID token de Google de un email en ADMIN_EMAILS.
// La ruta no puede empezar por "admin": está reservada por el host de Functions.

const PROHIBIDO = { status: 403, jsonBody: { error: 'No autorizado' } };

app.http('GestionListar', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'gestion/incidencias',
  handler: async (req, ctx) => {
    if (!(await esAdmin(req, ctx))) return PROHIBIDO;
    return { jsonBody: (await todas()).map(aGestion) };
  },
});

app.http('GestionCambiarEstado', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'gestion/incidencias/{id}',
  handler: async (req, ctx) => {
    if (!(await esAdmin(req, ctx))) return PROHIBIDO;
    let estado: unknown;
    try {
      estado = ((await req.json()) as { estado?: unknown } | null)?.estado;
    } catch {
      return { status: 400, jsonBody: { error: 'JSON no válido' } };
    }
    if (typeof estado !== 'string' || !(ESTADOS as readonly string[]).includes(estado)) {
      return { status: 400, jsonBody: { error: 'Estado no válido' } };
    }
    const e = await modificar(req.params['id'], (x) => { x.estado = estado as Estado; });
    return e ? { jsonBody: aGestion(e) } : { status: 404 };
  },
});
