import type { RespuestaHttp } from './farolas';

/** GET /api/config: configuración pública de la web. El client ID de Google no es secreto. */
export function respuestaConfig(env: NodeJS.ProcessEnv = process.env): RespuestaHttp {
  return {
    status: 200,
    headers: { 'Cache-Control': 'public, max-age=300' },
    jsonBody: { googleClientId: env.GOOGLE_CLIENT_ID ?? '' },
  };
}
