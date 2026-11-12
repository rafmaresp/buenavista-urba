import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  it('muestra el título y el aviso de obra', async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Buenavista I · Incidencias');
    expect(el.textContent).toContain('En construcción');
  });
});
