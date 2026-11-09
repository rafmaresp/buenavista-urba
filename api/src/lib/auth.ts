import { HttpRequest, InvocationContext } from '@azure/functions';
import { OAuth2Client } from 'google-auth-library';

/**
 * Login de la junta con Google Identity Services. El front manda el ID token de Google en la cabecera
 * X-Urba-Token (no Authorization, para que SWA no la toque). Se valida firma, audiencia (GOOGLE_CLIENT_ID)
 * y caducidad, y que el email verificado esté en ADMIN_EMAILS (separados por comas).
 */
export const CABECERA = 'x-urba-token';

const google = new OAuth2Client();

const admins = () =>
  new Set(
    (process.env['ADMIN_EMAILS'] ?? '')
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

export async function esAdmin(req: HttpRequest, ctx: InvocationContext): Promise<boolean> {
  const clientId = process.env['GOOGLE_CLIENT_ID'];
  const token = req.headers.get(CABECERA);
  if (!clientId || !token) return false;
  try {
    const ticket = await google.verifyIdToken({ idToken: token, audience: clientId });
    const p = ticket.getPayload();
    return !!p?.email_verified && !!p.email && admins().has(p.email.toLowerCase());
  } catch (err) {
    ctx.log('Token de Google rechazado:', (err as Error).message);
    return false;
  }
}
