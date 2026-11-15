import { TestBed } from '@angular/core/testing';
import { Sesion } from '../sesion';
import { FarolaPublica } from './farolas-cliente';
import { ErrorAviso, IncidenciaPublica } from './incidencias-cliente';
import * as L from 'leaflet';
import { ErrorReubicar } from './farolas-cliente';
import { Avisar, MapaFarolas, Reubicar, contenidoFicha } from './mapa-farolas';

const FAROLAS: FarolaPublica[] = [
  { id: 'F01', calle: 'C. M (paralela A-8032)', lat: 37.3186864, lon: -5.961454 },
  { id: 'F02', calle: 'C. M (paralela A-8032)', lat: 37.3184329, lon: -5.9617754 },
  { id: 'F03', calle: 'C. Ficticia', lat: 37.3181375, lon: -5.9620907 },
];

const INC_F02: IncidenciaPublica = { id: 'a1', farola: 'F02', estado: 'Nuevo', creada: '2026-11-15T19:30:00.000Z' };

async function montar(
  cargador: () => Promise<FarolaPublica[]>,
  opciones: { incidencias?: () => Promise<IncidenciaPublica[]>; avisar?: Avisar; reubicar?: Reubicar } = {},
) {
  const fixture = TestBed.createComponent(MapaFarolas);
  fixture.componentRef.setInput('cargador', cargador);
  fixture.componentRef.setInput('cargadorIncidencias', opciones.incidencias ?? (async () => []));
  if (opciones.avisar) fixture.componentRef.setInput('avisar', opciones.avisar);
  if (opciones.reubicar) fixture.componentRef.setInput('reubicar', opciones.reubicar);
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

describe('MapaFarolas — mover farola (specs/008)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [MapaFarolas] }));

  const NUEVA = { lat: 37.3189, lon: -5.9611 };

  function comoRol(rol: 'comunero' | 'directiva') {
    TestBed.inject(Sesion).rol.set(rol);
  }

  /** La marca de Leaflet de una farola (jsdom no simula el arrastre con el puntero). */
  function marca(fixture: { componentInstance: MapaFarolas }, id: string): L.Marker {
    return (fixture.componentInstance as unknown as { marcaDe: Map<string, L.Marker> }).marcaDe.get(id)!;
  }

  function soltarEn(m: L.Marker, pos: { lat: number; lon: number }) {
    m.setLatLng([pos.lat, pos.lon]);
    m.fire('dragend');
  }

  async function empezarMover(el: HTMLElement, fixture: Parameters<typeof esperar>[0], id = 'F01') {
    el.querySelector<HTMLElement>(`[title="Farola ${id}"]`)!.click();
    el.querySelector<HTMLButtonElement>('.leaflet-popup-content .ficha__mover')!.click();
    await esperar(fixture);
  }

  function barra(el: HTMLElement) {
    return el.querySelector<HTMLElement>('.mapa__mover');
  }

  function boton(el: HTMLElement, texto: string) {
    return Array.from(el.querySelectorAll<HTMLButtonElement>('.mapa__mover button')).find((b) => b.textContent === texto)!;
  }

  it('sin sesión la ficha no ofrece "Mover farola" (US3)', async () => {
    const { el } = await montar(async () => FAROLAS);
    el.querySelector<HTMLElement>('[title="Farola F01"]')!.click();
    expect(el.querySelector('.leaflet-popup-content .ficha__mover')).toBeNull();
  });

  it('un comunero tampoco ve "Mover farola" (US3)', async () => {
    comoRol('comunero');
    const { el } = await montar(async () => FAROLAS);
    el.querySelector<HTMLElement>('[title="Farola F01"]')!.click();
    expect(el.querySelector('.leaflet-popup-content .ficha__mover')).toBeNull();
  });

  it('la directiva mueve, confirma y guarda; la marca se queda en la nueva posición (US1)', async () => {
    comoRol('directiva');
    const llamadas: [string, number, number][] = [];
    const { fixture, el } = await montar(async () => FAROLAS, {
      reubicar: async (id, lat, lon) => {
        llamadas.push([id, lat, lon]);
        return { ...FAROLAS[0]!, lat, lon };
      },
    });
    await empezarMover(el, fixture);

    const m = marca(fixture, 'F01');
    expect(m.dragging!.enabled()).toBe(true);
    expect(marca(fixture, 'F02').dragging!.enabled()).toBe(false);
    expect(el.querySelector('.leaflet-popup-content')).toBeNull();
    expect(barra(el)?.textContent).toContain('Arrastra F01 a su sitio.');
    expect(boton(el, 'Guardar').disabled).toBe(true);

    soltarEn(m, NUEVA);
    await esperar(fixture);
    expect(barra(el)?.textContent).toContain('¿Mover F01 aquí?');
    expect(llamadas).toEqual([]);

    boton(el, 'Guardar').click();
    await esperar(fixture);

    expect(llamadas).toEqual([['F01', NUEVA.lat, NUEVA.lon]]);
    expect(m.getLatLng()).toMatchObject({ lat: NUEVA.lat, lng: NUEVA.lon });
    expect(m.dragging!.enabled()).toBe(false);
    expect(barra(el)?.getAttribute('role')).toBe('status');
    expect(barra(el)?.textContent).toContain('F01 se ha movido.');
  });

  it('redondea a 7 decimales lo que manda', async () => {
    comoRol('directiva');
    const llamadas: number[][] = [];
    const { fixture, el } = await montar(async () => FAROLAS, {
      reubicar: async (id, lat, lon) => {
        llamadas.push([lat, lon]);
        return { ...FAROLAS[0]!, lat, lon };
      },
    });
    await empezarMover(el, fixture);
    soltarEn(marca(fixture, 'F01'), { lat: 37.318912345678, lon: -5.961198765432 });
    await esperar(fixture);
    boton(el, 'Guardar').click();
    await esperar(fixture);
    expect(llamadas).toEqual([[37.3189123, -5.9611988]]);
  });

  it('Cancelar tras soltar devuelve la marca y no envía nada (US2)', async () => {
    comoRol('directiva');
    let llamadas = 0;
    const { fixture, el } = await montar(async () => FAROLAS, {
      reubicar: async () => {
        llamadas++;
        return FAROLAS[0]!;
      },
    });
    await empezarMover(el, fixture);
    const m = marca(fixture, 'F01');
    soltarEn(m, NUEVA);
    await esperar(fixture);

    boton(el, 'Cancelar').click();
    await esperar(fixture);

    expect(llamadas).toBe(0);
    expect(m.getLatLng()).toMatchObject({ lat: FAROLAS[0]!.lat, lng: FAROLAS[0]!.lon });
    expect(m.dragging!.enabled()).toBe(false);
    expect(barra(el)).toBeNull();
  });

  it('Cancelar antes de soltar sale del modo mover sin cambios (US2)', async () => {
    comoRol('directiva');
    const { fixture, el } = await montar(async () => FAROLAS);
    await empezarMover(el, fixture);
    boton(el, 'Cancelar').click();
    await esperar(fixture);
    expect(marca(fixture, 'F01').dragging!.enabled()).toBe(false);
    expect(barra(el)).toBeNull();
  });

  it('mover otra farola cancela la anterior y la devuelve a su sitio', async () => {
    comoRol('directiva');
    const { fixture, el } = await montar(async () => FAROLAS);
    await empezarMover(el, fixture, 'F01');
    soltarEn(marca(fixture, 'F01'), NUEVA);
    await empezarMover(el, fixture, 'F02');

    expect(marca(fixture, 'F01').getLatLng()).toMatchObject({ lat: FAROLAS[0]!.lat });
    expect(marca(fixture, 'F01').dragging!.enabled()).toBe(false);
    expect(barra(el)?.textContent).toContain('Arrastra F02');
  });

  it.each([
    ['sin-sesion', 'Vuelve a entrar'],
    ['cambiada', 'Otra persona ha movido esta farola'],
    ['no-valido', 'dentro de la urbanización'],
    ['no-disponible', 'Inténtalo de nuevo'],
  ] as const)('si guardar falla (%s) la marca vuelve y se explica (US2)', async (motivo, texto) => {
    comoRol('directiva');
    const { fixture, el } = await montar(async () => FAROLAS, {
      reubicar: async () => Promise.reject(new ErrorReubicar(motivo)),
    });
    await empezarMover(el, fixture);
    const m = marca(fixture, 'F01');
    soltarEn(m, NUEVA);
    await esperar(fixture);
    boton(el, 'Guardar').click();
    await esperar(fixture);

    expect(m.getLatLng()).toMatchObject({ lat: FAROLAS[0]!.lat, lng: FAROLAS[0]!.lon });
    expect(m.dragging!.enabled()).toBe(false);
    expect(barra(el)?.getAttribute('role')).toBe('alert');
    expect(barra(el)?.textContent).toContain(texto);
  });

  it('mientras se guarda una farola no se puede empezar a mover otra (revisión PR #34)', async () => {
    comoRol('directiva');
    let responder!: () => void;
    const { fixture, el } = await montar(async () => FAROLAS, {
      reubicar: (id, lat, lon) =>
        new Promise((r) => {
          responder = () => r({ ...FAROLAS[0]!, id, lat, lon });
        }),
    });
    await empezarMover(el, fixture, 'F01');
    soltarEn(marca(fixture, 'F01'), NUEVA);
    await esperar(fixture);
    boton(el, 'Guardar').click();
    await esperar(fixture);

    el.querySelector<HTMLElement>('[title="Farola F02"]')!.click();
    expect(el.querySelector('.leaflet-popup-content .ficha__mover')).toBeNull();
    fixture.componentInstance.empezarMover('F02');
    expect(marca(fixture, 'F02').dragging!.enabled()).toBe(false);

    responder();
    await esperar(fixture);
    expect(marca(fixture, 'F01').getLatLng()).toMatchObject({ lat: NUEVA.lat, lng: NUEVA.lon });
    expect(barra(el)?.textContent).toContain('F01 se ha movido.');
  });

  it('si el mapa se recarga mientras se guarda, la respuesta no toca el estado nuevo', async () => {
    comoRol('directiva');
    let fallar!: () => void;
    const { fixture, el } = await montar(async () => FAROLAS, {
      reubicar: () =>
        new Promise((_, rechazar) => {
          fallar = () => rechazar(new ErrorReubicar('no-disponible'));
        }),
    });
    await empezarMover(el, fixture, 'F01');
    soltarEn(marca(fixture, 'F01'), NUEVA);
    await esperar(fixture);
    boton(el, 'Guardar').click();
    await esperar(fixture);
    await fixture.componentInstance.cargar();
    await empezarMover(el, fixture, 'F02');

    fallar();
    await esperar(fixture);
    expect(fixture.componentInstance.movimiento()).toEqual({ id: 'F02', fase: 'arrastrando' });
    expect(marca(fixture, 'F02').dragging!.enabled()).toBe(true);
  });

  it('un error inesperado también devuelve la marca', async () => {
    comoRol('directiva');
    const { fixture, el } = await montar(async () => FAROLAS, { reubicar: async () => Promise.reject(new Error('x')) });
    await empezarMover(el, fixture);
    soltarEn(marca(fixture, 'F01'), NUEVA);
    await esperar(fixture);
    boton(el, 'Guardar').click();
    await esperar(fixture);
    expect(marca(fixture, 'F01').getLatLng()).toMatchObject({ lat: FAROLAS[0]!.lat });
    expect(barra(el)?.textContent).toContain('Inténtalo de nuevo');
  });

  it('la ficha sigue mostrando la incidencia de una farola que se puede mover', async () => {
    comoRol('directiva');
    const { el } = await montar(async () => FAROLAS, { incidencias: async () => [INC_F02] });
    el.querySelector<HTMLElement>('[title="Farola F02"]')!.click();
    const ficha = el.querySelector('.leaflet-popup-content .ficha')!;
    expect(ficha.querySelector('.ficha__incidencia')).not.toBeNull();
    expect(ficha.querySelector('.ficha__mover')?.textContent).toBe('Mover farola');
  });
});
