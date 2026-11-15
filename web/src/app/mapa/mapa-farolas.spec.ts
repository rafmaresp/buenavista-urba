import { TestBed } from '@angular/core/testing';
import { Sesion } from '../sesion';
import { FarolaPublica } from './farolas-cliente';
import { ErrorAviso, IncidenciaPublica } from './incidencias-cliente';
import { Avisar, MapaFarolas, contenidoFicha } from './mapa-farolas';

const FAROLAS: FarolaPublica[] = [
  { id: 'F01', calle: 'C. M (paralela A-8032)', lat: 37.3186864, lon: -5.961454 },
  { id: 'F02', calle: 'C. M (paralela A-8032)', lat: 37.3184329, lon: -5.9617754 },
  { id: 'F03', calle: 'C. Ficticia', lat: 37.3181375, lon: -5.9620907 },
];

const INC_F02: IncidenciaPublica = { id: 'a1', farola: 'F02', estado: 'Nuevo', creada: '2026-11-15T19:30:00.000Z' };

async function montar(
  cargador: () => Promise<FarolaPublica[]>,
  opciones: { incidencias?: () => Promise<IncidenciaPublica[]>; avisar?: Avisar } = {},
) {
  const fixture = TestBed.createComponent(MapaFarolas);
  fixture.componentRef.setInput('cargador', cargador);
  fixture.componentRef.setInput('cargadorIncidencias', opciones.incidencias ?? (async () => []));
  if (opciones.avisar) fixture.componentRef.setInput('avisar', opciones.avisar);
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('MapaFarolas', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [MapaFarolas] }));

  it('pinta una marca por farola con su código (US1)', async () => {
    const { el } = await montar(async () => FAROLAS);
    const marcas = Array.from(el.querySelectorAll<HTMLElement>('.farola-marca'));
    expect(marcas.map((m) => m.title)).toEqual(['Farola F01', 'Farola F02', 'Farola F03']);
    expect(marcas.map((m) => m.textContent)).toEqual(['F01', 'F02', 'F03']);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelector('[role="status"]')).toBeNull();
  });

  it('ofrece Ortofoto (por defecto) y Callejero (US3)', async () => {
    const { el } = await montar(async () => FAROLAS);
    const capas = Array.from(el.querySelectorAll<HTMLLabelElement>('.leaflet-control-layers-base label'));
    expect(capas.map((l) => l.textContent?.trim())).toEqual(['Ortofoto', 'Callejero']);
    expect(capas[0]!.querySelector('input')!.checked).toBe(true);
    expect(el.querySelector('.leaflet-control-attribution')?.textContent).toContain('PNOA © IGN');
  });

  it('muestra "Cargando farolas…" mientras llega el catálogo (US4)', async () => {
    const { el } = await montar(() => new Promise<FarolaPublica[]>(() => {}));
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Cargando farolas');
  });

  it('si la carga falla avisa y "Reintentar" pinta las farolas (US4, FR-006)', async () => {
    let intentos = 0;
    const { fixture, el } = await montar(async () => {
      intentos++;
      if (intentos === 1) throw new Error('500');
      return FAROLAS;
    });
    const aviso = el.querySelector('[role="alert"]');
    expect(aviso?.textContent).toContain('No se pudieron cargar las farolas');
    expect(el.querySelectorAll('.farola-marca')).toHaveLength(0);

    aviso!.querySelector('button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(intentos).toBe(2);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelectorAll('.farola-marca')).toHaveLength(3);
  });

  it('al reintentar no duplica las marcas', async () => {
    const { fixture, el } = await montar(async () => FAROLAS);
    await fixture.componentInstance.cargar();
    expect(el.querySelectorAll('.farola-marca')).toHaveLength(3);
  });

  it('al tocar una farola abre su ficha con código y calle (US2)', async () => {
    const { el } = await montar(async () => FAROLAS);
    el.querySelector<HTMLElement>('[title="Farola F03"]')!.click();
    const ficha = el.querySelector('.leaflet-popup-content .ficha');
    expect(ficha?.querySelector('h2')?.textContent).toBe('F03');
    expect(ficha?.querySelector('p')?.textContent).toBe('C. Ficticia');
  });
});

async function esperar(fixture: { whenStable: () => Promise<unknown>; detectChanges: () => void }) {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('MapaFarolas — incidencias (specs/006)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [MapaFarolas] }));

  function entrar() {
    // Solo para mostrar el formulario: el rol lo decide la API en cada aviso.
    TestBed.inject(Sesion).rol.set('comunero');
  }

  it('marca las farolas con incidencia abierta y su ficha muestra estado y fecha (US3)', async () => {
    const { el } = await montar(async () => FAROLAS, { incidencias: async () => [INC_F02] });
    const marcadas = Array.from(el.querySelectorAll<HTMLElement>('.farola-marca--incidencia')).map((m) => m.title);
    expect(marcadas).toEqual(['Farola F02']);

    el.querySelector<HTMLElement>('[title="Farola F02"]')!.click();
    const ficha = el.querySelector('.leaflet-popup-content .ficha')!;
    expect(ficha.querySelector('.ficha__incidencia')?.textContent).toBe('Incidencia abierta: Nuevo, avisada el 15/11/2026');
    expect(ficha.querySelector('form')).toBeNull();
  });

  it('si fallan las incidencias, las farolas se ven y hay un aviso (FR-010)', async () => {
    const { el } = await montar(async () => FAROLAS, {
      incidencias: async () => Promise.reject(new Error('500')),
    });
    expect(el.querySelectorAll('.farola-marca')).toHaveLength(3);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudieron cargar las incidencias');
  });

  it('sin sesión, la ficha invita a entrar y no muestra el formulario (US1)', async () => {
    const { el } = await montar(async () => FAROLAS);
    el.querySelector<HTMLElement>('[title="Farola F01"]')!.click();
    const enlace = el.querySelector<HTMLAnchorElement>('.leaflet-popup-content .ficha__entrar');
    expect(enlace?.getAttribute('href')).toBe('/login');
    expect(el.querySelector('.leaflet-popup-content form')).toBeNull();
  });

  it('con sesión avisa con el comentario y marca la farola sin recargar (US1, FR-009)', async () => {
    entrar();
    const avisos: [string, string][] = [];
    const { fixture, el } = await montar(async () => FAROLAS, {
      avisar: async (farola, comentario) => {
        avisos.push([farola, comentario]);
        return { id: 'n1', farola, estado: 'Nuevo', creada: '2026-11-15T19:30:00.000Z' };
      },
    });
    el.querySelector<HTMLElement>('[title="Farola F01"]')!.click();
    const form = el.querySelector<HTMLFormElement>('.leaflet-popup-content form')!;
    expect(form.textContent).toContain('No escribas nombres ni datos de otras personas.');
    const texto = form.querySelector('textarea')!;
    expect(texto.maxLength).toBe(280);
    texto.value = 'Parpadea';
    texto.dispatchEvent(new Event('input'));
    expect(form.querySelector('.ficha__contador')?.textContent).toBe('8/280');

    form.querySelector('button')!.click();
    await esperar(fixture);

    expect(avisos).toEqual([['F01', 'Parpadea']]);
    expect(el.querySelector('[title="Farola F01"]')!.classList).toContain('farola-marca--incidencia');
    expect(el.querySelector('.leaflet-popup-content .ficha__incidencia')?.textContent).toContain('Incidencia abierta: Nuevo');
  });

  it('si el aviso falla muestra el error y deja reintentar', async () => {
    entrar();
    const { fixture, el } = await montar(async () => FAROLAS, {
      avisar: async () => Promise.reject(new ErrorAviso('sin-sesion')),
    });
    el.querySelector<HTMLElement>('[title="Farola F01"]')!.click();
    const form = el.querySelector<HTMLFormElement>('.leaflet-popup-content form')!;
    form.querySelector('button')!.click();
    await esperar(fixture);

    const error = form.querySelector<HTMLElement>('.ficha__error')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('Vuelve a entrar');
    expect(form.querySelector('button')!.disabled).toBe(false);
    expect(el.querySelector('.farola-marca--incidencia')).toBeNull();
  });

  it('un error que no es de sesión pide reintentar', () => {
    const ficha = contenidoFicha(FAROLAS[0]!, { dentro: true, avisar: async () => Promise.reject(new Error('x')) });
    ficha.querySelector('form')!.dispatchEvent(new Event('submit'));
    return new Promise<void>((r) =>
      setTimeout(() => {
        expect(ficha.querySelector('.ficha__error')?.textContent).toBe('No se pudo enviar el aviso. Inténtalo de nuevo.');
        r();
      }, 0),
    );
  });
});

describe('contenidoFicha', () => {
  it('muestra la calle como texto, sin interpretar HTML', () => {
    const ficha = contenidoFicha({ id: 'F09', calle: '<img src=x onerror=alert(1)>', lat: 0, lon: 0 });
    expect(ficha.querySelector('h2')?.textContent).toBe('F09');
    expect(ficha.querySelector('p')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(ficha.querySelector('img')).toBeNull();
  });
});
