import { describe, expect, it, vi } from 'vitest';
import { respuestaConfig } from './config';
import type { DepsIdentidad } from './identidad';
import { LimitePeticiones } from './limite';
import { auditoriaDoble, filaAna, tablaUsuarios } from './pruebas/usuarios-dobles';
import { RepositorioUsuarios } from './usuarios-repo';
import { respuestaYo } from './yo';

function deps(rol = 'directiva'): DepsIdentidad {
  const { cliente, orden } = tablaUsuarios([filaAna({ sub: 'google-ana', rol })]);
  return {
    clientId: 'cliente',
    verificar: vi.fn(async () => ({ sub: 'google-ana', email: 'ana@example.com', email_verified: true })),
    usuarios: () => new RepositorioUsuarios(cliente, auditoriaDoble(orden)),
    limite: new LimitePeticiones(),
    registrarError: () => {},
  };
}

const con = (token?: string) => ({ get: (n: string) => (n === 'x-id-token' && token ? token : null) });

describe('GET /api/yo', () => {
  it('devuelve solo el rol, sin caché', async () => {
    expect(await respuestaYo(con('t'), deps())).toEqual({
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
      jsonBody: { rol: 'directiva' },
    });
  });

  it('sin token: 401', async () => {
    expect((await respuestaYo(con(), deps())).status).toBe(401);
  });
});

describe('GET /api/config', () => {
  it('devuelve el client ID público, cacheable', () => {
    expect(respuestaConfig({ GOOGLE_CLIENT_ID: 'abc.apps.googleusercontent.com' })).toEqual({
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=300' },
      jsonBody: { googleClientId: 'abc.apps.googleusercontent.com' },
    });
  });

  it('sin configurar devuelve cadena vacía', () => {
    expect(respuestaConfig({}).jsonBody).toEqual({ googleClientId: '' });
  });
});
