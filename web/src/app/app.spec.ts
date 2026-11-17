import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { Sesion } from './sesion';

describe('App', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes)] }));

  it('muestra el título, el enlace para entrar y el mapa de farolas en el inicio', async () => {
    const fixture = TestBed.createComponent(App);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Buenavista I · Incidencias');
    expect(el.querySelector('a[href="/login"]')?.textContent).toContain('Entrar');
    expect(harness.routeNativeElement?.querySelector('app-mapa-farolas [aria-label="Mapa de farolas"]')).not.toBeNull();
  });

  it('con sesión muestra el rol y permite salir', async () => {
    const sesion = TestBed.inject(Sesion);
    sesion.rol.set('directiva');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('nav')?.textContent).toContain('directiva');
    (el.querySelector('nav button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(sesion.dentro()).toBe(false);
    expect(el.querySelector('nav')?.textContent).toContain('Entrar');
  });

  it.each([
    ['directiva', true],
    ['comunero', false],
  ] as const)('con rol %s, el enlace a Usuarios se muestra: %s', (rol, visible) => {
    TestBed.inject(Sesion).rol.set(rol);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const enlace = (fixture.nativeElement as HTMLElement).querySelector('nav a[href="/usuarios"]');
    expect(Boolean(enlace)).toBe(visible);
  });
});
