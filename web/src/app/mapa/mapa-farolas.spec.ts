import { TestBed } from '@angular/core/testing';
import { FarolaPublica } from './farolas-cliente';
import { MapaFarolas, contenidoFicha } from './mapa-farolas';

const FAROLAS: FarolaPublica[] = [
  { id: 'F01', calle: 'C. M (paralela A-8032)', lat: 37.3186864, lon: -5.961454 },
  { id: 'F02', calle: 'C. M (paralela A-8032)', lat: 37.3184329, lon: -5.9617754 },
  { id: 'F03', calle: 'C. Ficticia', lat: 37.3181375, lon: -5.9620907 },
];

async function montar(cargador: () => Promise<FarolaPublica[]>) {
  const fixture = TestBed.createComponent(MapaFarolas);
  fixture.componentRef.setInput('cargador', cargador);
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

describe('contenidoFicha', () => {
  it('muestra la calle como texto, sin interpretar HTML', () => {
    const ficha = contenidoFicha({ id: 'F09', calle: '<img src=x onerror=alert(1)>', lat: 0, lon: 0 });
    expect(ficha.querySelector('h2')?.textContent).toBe('F09');
    expect(ficha.querySelector('p')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(ficha.querySelector('img')).toBeNull();
  });
});
