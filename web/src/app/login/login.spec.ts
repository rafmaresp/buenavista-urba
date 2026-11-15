import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CARGADOR_GIS, type GoogleId } from '../gis';
import { Sesion } from '../sesion';
import { Login } from './login';

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('Login', () => {
  let callback: ((r: { credential: string }) => void) | undefined;
  const gis: GoogleId = {
    initialize: vi.fn((o) => (callback = o.callback)),
    renderButton: vi.fn(),
  };
  let cargador: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    callback = undefined;
    cargador = vi.fn(async () => gis);
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: CARGADOR_GIS, useValue: cargador }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function montar() {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('muestra la cláusula antes del botón de Google y enlaza a /privacidad', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ googleClientId: 'cid' }));
    const { el } = await montar();
    const clausula = el.querySelector('[data-testid="clausula"]')!;
    const boton = el.querySelector('[data-testid="boton-google"]')!;
    expect(clausula.textContent).toContain('Responsable: Comunidad de Propietarios Buenavista I');
    expect(clausula.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(el.querySelector('a[href="/privacidad"]')).toBeTruthy();
    expect(gis.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'cid' }));
    expect(gis.renderButton).toHaveBeenCalledWith(boton, expect.objectContaining({ locale: 'es' }));
  });

  it('sin client ID no carga Google y avisa', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ googleClientId: '' }));
    const { el } = await montar();
    expect(cargador).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('no está disponible');
  });

  it('al elegir cuenta entra y muestra el rol', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ googleClientId: 'cid' }));
    const { fixture, el } = await montar();
    const entrar = vi.spyOn(TestBed.inject(Sesion), 'entrar').mockImplementation(async () => {
      TestBed.inject(Sesion).rol.set('directiva');
      return 'ok';
    });
    callback!({ credential: 'tok' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(entrar).toHaveBeenCalledWith('tok');
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Has entrado como directiva');
  });

  it('fuera de la lista muestra "No tienes acceso"', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ googleClientId: 'cid' }));
    const { fixture, el } = await montar();
    vi.spyOn(TestBed.inject(Sesion), 'entrar').mockResolvedValue('sin-acceso');
    callback!({ credential: 'tok' });
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No tienes acceso');
  });
});
