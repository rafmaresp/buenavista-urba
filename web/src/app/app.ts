import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Sesion } from './sesion';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html'
})
export class App {
  protected readonly title = signal('Buenavista I · Incidencias');
  protected readonly sesion = inject(Sesion);
}
