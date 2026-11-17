import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Sesion } from '../sesion';
import { Usuarios } from './usuarios';

const ANA = { uid: 'u-ana', email: 'ana@example.com', rol: 'directiva', estado: 'activo', vinculado: true, propio: true };
const BEA = { uid: 'u-bea', email: 'bea@example.com', rol: 'comunero', estado: 'activo', vinculado: false, propio: false };

function json(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

type LlamarMock = (url: string, init?: RequestInit) => Promise<Response>;

async function montar(rol: 'comunero' | 'directiva' | null, llamar: ReturnType<typeof vi.fn<LlamarMock>>) {
  TestBed.configureTestingModule({ imports: [Usuarios], providers: [provideRouter([])] });
  const sesion = TestBed.inject(Sesion);
  sesion.rol.set(rol);
  vi.spyOn(sesion, 'llamar').mockImplementation(llamar);
  const fixture = TestBed.createComponent(Usuarios);
  await asentar(fixture);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

/** Deja correr las promesas pendientes (fetch simulados) y vuelve a pintar. */
async function asentar(fixture: { detectChanges(): void }) {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  }
}

const filas = (el: HTMLElement) => [...el.querySelectorAll('.usuarios__lista li')];

describe('Usuarios', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sin sesión invita a entrar y no llama a la API', async () => {
    const llamar = vi.fn<LlamarMock>();
    const { el } = await montar(null, llamar);
    expect(el.textContent).toContain('entra con tu cuenta');
    expect(llamar).not.toHaveBeenCalled();
  });

  it('un comunero ve que es solo para la directiva y no llama a la API', async () => {
    const llamar = vi.fn<LlamarMock>();
    const { el } = await montar('comunero', llamar);
    expect(el.textContent).toContain('Solo la directiva');
    expect(llamar).not.toHaveBeenCalled();
  });

  it('la directiva ve la lista; en su fila no hay controles de rol ni baja', async () => {
    const { el } = await montar('directiva', vi.fn<LlamarMock>().mockImplementation(async () => json(200, { usuarios: [ANA, BEA] })));
    const [ana, bea] = filas(el);
    expect(ana!.textContent).toContain('ana@example.com (tú)');
    expect(ana!.querySelector('button, select')).toBeNull();
    expect(bea!.textContent).toContain('aún no ha entrado');
    expect(bea!.querySelector('button')!.textContent).toContain('Dar de baja');
  });

  it('da de alta con el formulario y recarga la lista', async () => {
    const llamar = vi
      .fn()
      .mockResolvedValueOnce(json(200, { usuarios: [ANA] }))
      .mockResolvedValueOnce(json(201, { usuario: BEA }))
      .mockResolvedValueOnce(json(200, { usuarios: [ANA, BEA] }));
    const { fixture, el } = await montar('directiva', llamar);
    const input = el.querySelector<HTMLInputElement>('input[name=email]')!;
    input.value = 'bea@example.com';
    input.dispatchEvent(new Event('input'));
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await asentar(fixture);

    const [, init] = llamar.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ email: 'bea@example.com', rol: 'comunero' });
    expect(el.querySelector('[role=status]')!.textContent).toContain('bea@example.com ya puede entrar como comunero');
    expect(filas(el)).toHaveLength(2);
  });

  it('un correo repetido muestra el aviso de que ya existe', async () => {
    const llamar = vi
      .fn()
      .mockResolvedValueOnce(json(200, { usuarios: [ANA, BEA] }))
      .mockResolvedValueOnce(json(409, { error: 'ya-existe' }))
      .mockResolvedValueOnce(json(200, { usuarios: [ANA, BEA] }));
    const { fixture, el } = await montar('directiva', llamar);
    const input = el.querySelector<HTMLInputElement>('input[name=email]')!;
    input.value = 'bea@example.com';
    input.dispatchEvent(new Event('input'));
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await asentar(fixture);
    expect(el.querySelector('.usuarios__aviso--error')!.textContent).toContain('ya está en la lista');
  });

  it('da de baja con PATCH y luego ofrece reactivar', async () => {
    const baja = { ...BEA, estado: 'baja' };
    const llamar = vi
      .fn()
      .mockResolvedValueOnce(json(200, { usuarios: [ANA, BEA] }))
      .mockResolvedValueOnce(json(200, { usuario: baja }))
      .mockResolvedValueOnce(json(200, { usuarios: [ANA, baja] }));
    const { fixture, el } = await montar('directiva', llamar);
    filas(el)[1]!.querySelector('button')!.click();
    await asentar(fixture);

    const [url, init] = llamar.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/usuarios/u-bea');
    expect(JSON.parse(init.body as string)).toEqual({ estado: 'baja' });
    expect(filas(el)[1]!.querySelector('button')!.textContent).toContain('Reactivar');
    expect(el.querySelector('[role=status]')!.textContent).toContain('se ha dado de baja');
  });

  it('cambia el rol con el selector', async () => {
    const llamar = vi
      .fn()
      .mockResolvedValueOnce(json(200, { usuarios: [ANA, BEA] }))
      .mockResolvedValueOnce(json(200, { usuario: { ...BEA, rol: 'directiva' } }))
      .mockResolvedValueOnce(json(200, { usuarios: [ANA, { ...BEA, rol: 'directiva' }] }));
    const { fixture, el } = await montar('directiva', llamar);
    const select = filas(el)[1]!.querySelector('select')!;
    select.value = 'directiva';
    select.dispatchEvent(new Event('change'));
    await asentar(fixture);
    expect(JSON.parse((llamar.mock.calls[1] as [string, RequestInit])[1].body as string)).toEqual({ rol: 'directiva' });
    expect(el.querySelector('[role=status]')!.textContent).toContain('ahora es directiva');
  });

  it('si falla el cambio de rol, el selector vuelve a mostrar el rol guardado', async () => {
    const llamar = vi
      .fn<LlamarMock>()
      .mockResolvedValueOnce(json(200, { usuarios: [ANA, BEA] }))
      .mockResolvedValueOnce(json(503, { error: 'no-disponible' }))
      .mockResolvedValueOnce(json(200, { usuarios: [ANA, BEA] }));
    const { fixture, el } = await montar('directiva', llamar);
    const select = filas(el)[1]!.querySelector('select')!;
    select.value = 'directiva';
    select.dispatchEvent(new Event('change'));
    await asentar(fixture);
    expect(el.querySelector('.usuarios__aviso--error')!.textContent).toContain('No se ha podido completar');
    expect(filas(el)[1]!.querySelector('select')!.value).toBe('comunero');
  });

  it('si la lista no carga, explica que no está disponible', async () => {
    const { el } = await montar('directiva', vi.fn<LlamarMock>().mockImplementation(async () => json(503, { error: 'no-disponible' })));
    expect(el.querySelector('.usuarios__aviso--error')!.textContent).toContain('No se ha podido completar');
  });
});
