import { Component, signal } from '@angular/core';
import { MapaFarolas } from './mapa/mapa-farolas';

@Component({
  selector: 'app-root',
  imports: [MapaFarolas],
  templateUrl: './app.html'
})
export class App {
  protected readonly title = signal('Buenavista I · Incidencias');
}
