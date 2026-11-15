import { Component } from '@angular/core';
import { MapaFarolas } from '../mapa/mapa-farolas';

/** Ruta '': el mapa público de farolas. */
@Component({
  selector: 'app-inicio',
  imports: [MapaFarolas],
  template: '<app-mapa-farolas />',
})
export class Inicio {}
