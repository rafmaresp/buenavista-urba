import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Privacidad } from './privacidad';

describe('Privacidad', () => {
  it('muestra la política con responsable, conservación y derechos', () => {
    TestBed.configureTestingModule({ imports: [Privacidad], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Privacidad);
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent!;
    for (const apartado of ['Responsable', 'Conservación', 'Tus derechos', 'Agencia Española de Protección de Datos']) expect(texto).toContain(apartado);
  });
});
