import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { Sesion } from './sesion';

describe('App', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes)] }));

  it('muestra el título, el inicio y el enlace para entrar', async () => {
    const fixture = TestBed.createComponent(App);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Buenavista I · Incidencias');
    expect(el.querySelector('a[href="/login"]')?.textContent).toContain('Entrar');
    expect(harness.routeNativeElement?.textContent).toContain('En construcción');
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
});
