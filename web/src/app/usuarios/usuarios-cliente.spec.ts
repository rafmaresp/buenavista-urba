import { ErrorUsuarios, altaUsuario, cambiarUsuario, listarUsuarios } from './usuarios-cliente';

const BEA = { uid: 'u-bea', email: 'bea@example.com', rol: 'comunero', estado: 'activo', vinculado: false, propio: false };

function respuesta(status: number, cuerpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

describe('usuarios-cliente', () => {
  it('listarUsuarios valida la respuesta', async () => {
    const llamar = vi.fn().mockResolvedValue(respuesta(200, { usuarios: [BEA] }));
    expect(await listarUsuarios(llamar)).toEqual([BEA]);
    expect(llamar).toHaveBeenCalledWith('/api/usuarios', undefined);
  });

  it('listarUsuarios rechaza una respuesta con forma inesperada', async () => {
    const llamar = vi.fn().mockResolvedValue(respuesta(200, { usuarios: [{ ...BEA, rol: 'admin' }] }));
    await expect(listarUsuarios(llamar)).rejects.toMatchObject({ motivo: 'no-disponible' });
  });

  it('altaUsuario manda solo correo y rol por POST', async () => {
    const llamar = vi.fn().mockResolvedValue(respuesta(201, { usuario: BEA }));
    expect(await altaUsuario(llamar, ' bea@example.com ', 'comunero')).toEqual(BEA);
    const [url, init] = llamar.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/usuarios');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'bea@example.com', rol: 'comunero' });
  });

  it('cambiarUsuario hace PATCH al uid codificado', async () => {
    const llamar = vi.fn().mockResolvedValue(respuesta(200, { usuario: { ...BEA, estado: 'baja' } }));
    await cambiarUsuario(llamar, 'u/1', { estado: 'baja' });
    const [url, init] = llamar.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/usuarios/u%2F1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ estado: 'baja' });
  });

  it.each([
    [409, { error: 'ya-existe' }, 'ya-existe'],
    [409, { error: 'propio-usuario' }, 'propio-usuario'],
    [409, { error: 'usuario-cambiado' }, 'usuario-cambiado'],
    [409, { error: 'otro' }, 'no-disponible'],
    [403, { error: 'sin-acceso' }, 'sin-acceso'],
    [401, {}, 'sin-acceso'],
    [400, {}, 'no-valido'],
    [404, {}, 'no-encontrado'],
    [503, {}, 'no-disponible'],
  ])('un %i %j es %s', async (status, cuerpo, motivo) => {
    const llamar = vi.fn().mockResolvedValue(respuesta(status, cuerpo));
    await expect(cambiarUsuario(llamar, 'u-bea', { rol: 'directiva' })).rejects.toMatchObject({ motivo });
  });

  it('sin conexión es no-disponible', async () => {
    const llamar = vi.fn().mockRejectedValue(new TypeError('red'));
    await expect(altaUsuario(llamar, 'a@b.es', 'comunero')).rejects.toBeInstanceOf(ErrorUsuarios);
  });
});
