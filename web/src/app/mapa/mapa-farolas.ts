import { Component, ElementRef, OnDestroy, afterNextRender, input, signal, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { CENTRO, ZOOM_ETIQUETAS, ZOOM_INICIAL, crearCapasBase } from './capas';
import { FarolaPublica, cargarFarolas } from './farolas-cliente';

export type EstadoCarga = 'cargando' | 'ok' | 'error';

/** Ficha de la farola: solo texto (textContent), nunca HTML interpolado. */
export function contenidoFicha(farola: FarolaPublica): HTMLElement {
  const ficha = document.createElement('div');
  ficha.className = 'ficha';
  const codigo = document.createElement('h2');
  codigo.textContent = farola.id;
  const calle = document.createElement('p');
  calle.textContent = farola.calle;
  ficha.append(codigo, calle);
  return ficha;
}

function iconoFarola(farola: FarolaPublica): L.DivIcon {
  const etiqueta = document.createElement('span');
  etiqueta.className = 'farola-marca__codigo';
  etiqueta.textContent = farola.id;
  return L.divIcon({ className: 'farola-marca', html: etiqueta, iconSize: [18, 18], iconAnchor: [9, 9] });
}

/** Mapa público de solo lectura (specs/004-mapa-farolas). */
@Component({
  selector: 'app-mapa-farolas',
  templateUrl: './mapa-farolas.html',
})
export class MapaFarolas implements OnDestroy {
  /** Inyectable en los tests; por defecto pide GET /api/farolas. */
  readonly cargador = input<() => Promise<FarolaPublica[]>>(() => cargarFarolas());

  protected readonly estado = signal<EstadoCarga>('cargando');
  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');
  private mapa?: L.Map;
  private readonly marcas = L.layerGroup();

  constructor() {
    afterNextRender(() => {
      this.crearMapa();
      void this.cargar();
    });
  }

  private crearMapa(): void {
    const capas = crearCapasBase();
    const mapa = L.map(this.contenedor().nativeElement, { center: CENTRO, zoom: ZOOM_INICIAL, layers: [capas['Ortofoto']!] });
    L.control.layers(capas, undefined, { collapsed: false }).addTo(mapa);
    this.marcas.addTo(mapa);
    const etiquetas = () => mapa.getContainer().classList.toggle('mapa--etiquetas', mapa.getZoom() >= ZOOM_ETIQUETAS);
    mapa.on('zoomend', etiquetas);
    etiquetas();
    this.mapa = mapa;
  }

  async cargar(): Promise<void> {
    this.estado.set('cargando');
    try {
      const farolas = await this.cargador()();
      this.pintar(farolas);
      this.estado.set('ok');
    } catch {
      this.estado.set('error');
    }
  }

  private pintar(farolas: FarolaPublica[]): void {
    this.marcas.clearLayers();
    for (const farola of farolas) {
      L.marker([farola.lat, farola.lon], { icon: iconoFarola(farola), title: `Farola ${farola.id}` })
        .bindPopup(() => contenidoFicha(farola))
        .addTo(this.marcas);
    }
    // Encaja la urbanización entera en la pantalla (en el móvil el centro fijo deja farolas fuera).
    if (farolas.length > 0) {
      this.mapa?.fitBounds(L.latLngBounds(farolas.map((f) => [f.lat, f.lon] as L.LatLngTuple)), { padding: [24, 24] });
    }
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
  }
}
