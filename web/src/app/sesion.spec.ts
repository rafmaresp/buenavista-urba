import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Sesion } from './sesion';

function respuesta(status: number, cuerpo: unknown = {}): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('Sesion', () => {
  let sesion: Sesion;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sesion = TestBed.inject(Sesion);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => vi.restoreAllMocks());

  it('entrar() valida el token con /api/yo en X-Id-Token y guarda el rol', async () => {
    fetchSpy.mockResolvedValue(respuesta(200, { rol: 'comunero' }));
    expect(await sesion.entrar('tok')).toBe('ok');
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/yo');
    expect(new Headers(init.headers).get('X-Id-Token')).toBe('tok');
    expect(sesion.rol()).toBe('comunero');
    expect(sesion.dentro()).toBe(true);
  });

  it('no guarda el token en el almacenamiento del navegador', async () => {
    fetchSpy.mockResolvedValue(respuesta(200, { rol: 'comunero' }));
    await sesion.entrar('tok');
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('tok');
  });

  it.each([
    [403, 'sin-acceso'],
    [401, 'sin-acceso'],
    [503, 'no-disponible'],
  ] as const)('si /api/yo responde %i devuelve %s y no queda dentro', async (status, esperado) => {
    fetchSpy.mockResolvedValue(respuesta(status));
    expect(await sesion.entrar('tok')).toBe(esperado);
    expect(sesion.dentro()).toBe(false);
  });

  it('un fallo de red devuelve no-disponible', async () => {
    fetchSpy.mockRejectedValue(new TypeError('red'));
    expect(await sesion.entrar('tok')).toBe('no-disponible');
  });

  it('llamar() manda el token y un 401 cierra la sesión y lleva a /login', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fetchSpy.mockResolvedValueOnce(respuesta(200, { rol: 'directiva' }));
    await sesion.entrar('tok');
    fetchSpy.mockResolvedValueOnce(respuesta(401));
    await sesion.llamar('/api/algo', { method: 'POST' });
    const init = fetchSpy.mock.calls[1]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('X-Id-Token')).toBe('tok');
    expect(sesion.dentro()).toBe(false);
    expect(navegar).toHaveBeenCalledWith('/login');
  });

  it('sin sesión, llamar() no manda token', async () => {
    fetchSpy.mockResolvedValue(respuesta(200));
    await sesion.llamar('/api/farolas');
    expect(new Headers((fetchSpy.mock.calls[0]![1] as RequestInit).headers).has('X-Id-Token')).toBe(false);
  });
});
