import { app } from '@azure/functions';
import { NuevaIncidencia, aPublica } from '../lib/modelos';
import { crear, farolaAbierta, modificar, todas } from '../lib/repo';
import { validar } from '../lib/validacion';

// Endpoints públicos para vecinos. Nunca devuelven el contacto.

app.http('ListarIncidencias', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'incidencias',
  handler: async () => ({ jsonBody: (await todas()).map(aPublica) }),
});

app.http('CrearIncidencia', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'incidencias',
  handler: async (req) => {
    let cuerpo: unknown;
    try {
      cuerpo = await req.json();
    } catch {
      return { status: 400, jsonBody: { error: 'JSON no válido' } };
    }
    if (!cuerpo || typeof cuerpo !== 'object') return { status: 400, jsonBody: { error: 'Cuerpo vacío' } };
    const v = validar(cuerpo as NuevaIncidencia);
    if (typeof v === 'string') return { status: 400, jsonBody: { error: v } };

    if (v.farolaId) {
      const ya = await farolaAbierta(v.farolaId);
      if (ya) return { status: 409, jsonBody: { error: 'Esta farola ya está reportada', existente: aPublica(ya) } };
    }
    const e = await crear(v);
    // TODO: aviso por correo a la junta (siguiente spec).
    return { status: 201, jsonBody: aPublica(e) };
  },
});

app.http('ApoyarIncidencia', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'incidencias/{id}/apoyos',
  handler: async (req) => {
    const e = await modificar(req.params['id'], (x) => { x.votos++; });
    return e ? { jsonBody: aPublica(e) } : { status: 404 };
  },
});
