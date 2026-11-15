import { Component, ElementRef, OnDestroy, afterNextRender, inject, input, signal, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { Sesion } from '../sesion';
import { CENTRO, ZOOM_ETIQUETAS, ZOOM_INICIAL, crearCapasBase } from './capas';
import { FarolaPublica, cargarFarolas } from './farolas-cliente';
import {
  ErrorAviso,
  IncidenciaPublica,
  MAX_COMENTARIO,
  cargarIncidencias,
  reportarIncidencia,
} from './incidencias-cliente';

export type EstadoCarga = 'cargando' | 'ok' | 'error';

/** Envía el aviso de una farola y devuelve su incidencia abierta (creada o existente). */
export type Avisar = (farola: string, comentario: string) => Promise<IncidenciaPublica>;

export interface OpcionesFicha {
  incidencia?: IncidenciaPublica;
  /** Hay sesión: se muestra el formulario de aviso. */
  dentro: boolean;
  /** Envía el aviso con el comentario escrito; si falla, lanza (ErrorAviso). */
  avisar?: (comentario: string) => Promise<void>;
}

const FECHA = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' });

export function fechaCorta(iso: string): string {
  return FECHA.format(new Date(iso));
}

function elemento<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase: string, texto = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(etiqueta);
  el.className = clase;
  el.textContent = texto;
  return el;
}

function mensajeError(e: unknown): string {
  if (e instanceof ErrorAviso && e.motivo === 'sin-sesion') return 'Tu sesión ha caducado o no tienes acceso. Vuelve a entrar.';
  return 'No se pudo enviar el aviso. Inténtalo de nuevo.';
}

/** Formulario de aviso: comentario opcional con contador y aviso de privacidad. */
function formularioAviso(avisar: (comentario: string) => Promise<void>): HTMLFormElement {
  const form = elemento('form', 'ficha__aviso');
  const etiqueta = elemento('label', 'ficha__etiqueta', 'Comentario (opcional)');
  const texto = elemento('textarea', 'ficha__comentario');
  texto.maxLength = MAX_COMENTARIO;
  texto.rows = 3;
  etiqueta.append(texto);
  const privacidad = elemento('p', 'ficha__nota', 'No escribas nombres ni datos de otras personas.');
  const contador = elemento('p', 'ficha__nota ficha__contador', `0/${MAX_COMENTARIO}`);
  const boton = elemento('button', 'ficha__boton', 'Avisar: farola fundida');
  boton.type = 'submit';
  const error = elemento('p', 'ficha__error');
  error.setAttribute('role', 'alert');
  error.hidden = true;

  texto.addEventListener('input', () => {
    contador.textContent = `${[...texto.value].length}/${MAX_COMENTARIO}`;
  });
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    boton.disabled = true;
    error.hidden = true;
    avisar(texto.value).catch((e: unknown) => {
      error.textContent = mensajeError(e);
      error.hidden = false;
      boton.disabled = false;
    });
  });

  form.append(etiqueta, privacidad, contador, boton, error);
  return form;
}

/** Ficha de la farola: solo texto (textContent), nunca HTML interpolado. */
export function contenidoFicha(farola: FarolaPublica, opciones: OpcionesFicha = { dentro: false }): HTMLElement {
  const ficha = elemento('div', 'ficha');
  ficha.append(elemento('h2', '', farola.id), elemento('p', '', farola.calle));

  if (opciones.incidencia) {
    const { estado, creada } = opciones.incidencia;
    ficha.append(elemento('p', 'ficha__incidencia', `Incidencia abierta: ${estado}, avisada el ${fechaCorta(creada)}`));
  } else if (opciones.dentro && opciones.avisar) {
    ficha.append(formularioAviso(opciones.avisar));
  } else {
    const enlace = elemento('a', 'ficha__entrar', 'Entra para avisar de que está fundida');
    enlace.href = '/login';
    ficha.append(enlace);
  }
  return ficha;
}

function iconoFarola(farola: FarolaPublica, conIncidencia: boolean): L.DivIcon {
  const etiqueta = document.createElement('span');
  etiqueta.className = 'farola-marca__codigo';
  etiqueta.textContent = farola.id;
  const clase = conIncidencia ? 'farola-marca farola-marca--incidencia' : 'farola-marca';
  return L.divIcon({ className: clase, html: etiqueta, iconSize: [18, 18], iconAnchor: [9, 9] });
}

/** Mapa público de farolas (specs/004-mapa-farolas) con las incidencias abiertas (specs/006). */
@Component({
  selector: 'app-mapa-farolas',
  templateUrl: './mapa-farolas.html',
})
export class MapaFarolas implements OnDestroy {
  private readonly sesion = inject(Sesion);

  /** Inyectables en los tests; por defecto piden GET /api/farolas y GET /api/incidencias. */
  readonly cargador = input<() => Promise<FarolaPublica[]>>(() => cargarFarolas());
  readonly cargadorIncidencias = input<() => Promise<IncidenciaPublica[]>>(() => cargarIncidencias());
  /** Por defecto POST /api/incidencias con el token de la sesión. */
  readonly avisar = input<Avisar>((farola, comentario) =>
    reportarIncidencia((url, init) => this.sesion.llamar(url, init), farola, comentario),
  );

  protected readonly estado = signal<EstadoCarga>('cargando');
  protected readonly errorIncidencias = signal(false);
  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');
  private mapa?: L.Map;
  private readonly marcas = L.layerGroup();
  private readonly marcaDe = new Map<string, L.Marker>();
  private readonly incidencias = new Map<string, IncidenciaPublica>();

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
    // Las incidencias no bloquean el mapa: si fallan, se avisa y las farolas se ven igual.
    const incidencias = this.cargadorIncidencias()().catch(() => null);
    try {
      const farolas = await this.cargador()();
      const abiertas = await incidencias;
      this.errorIncidencias.set(abiertas === null);
      this.incidencias.clear();
      for (const i of abiertas ?? []) this.incidencias.set(i.farola, i);
      this.pintar(farolas);
      this.estado.set('ok');
    } catch {
      this.estado.set('error');
    }
  }

  private pintar(farolas: FarolaPublica[]): void {
    this.marcas.clearLayers();
    this.marcaDe.clear();
    for (const farola of farolas) {
      const marca = L.marker([farola.lat, farola.lon], {
        icon: iconoFarola(farola, this.incidencias.has(farola.id)),
        title: `Farola ${farola.id}`,
      })
        .bindPopup(() => this.ficha(farola))
        .addTo(this.marcas);
      this.marcaDe.set(farola.id, marca);
    }
    // Encaja la urbanización entera en la pantalla (en el móvil el centro fijo deja farolas fuera).
    if (farolas.length > 0) {
      this.mapa?.fitBounds(L.latLngBounds(farolas.map((f) => [f.lat, f.lon] as L.LatLngTuple)), { padding: [24, 24] });
    }
  }

  private ficha(farola: FarolaPublica): HTMLElement {
    return contenidoFicha(farola, {
      incidencia: this.incidencias.get(farola.id),
      dentro: this.sesion.dentro(),
      avisar: async (comentario) => {
        const incidencia = await this.avisar()(farola.id, comentario);
        this.marcarIncidencia(farola, incidencia);
      },
    });
  }

  /** Tras avisar (o si ya había una), la marca y la ficha muestran la incidencia sin recargar. */
  private marcarIncidencia(farola: FarolaPublica, incidencia: IncidenciaPublica): void {
    this.incidencias.set(farola.id, incidencia);
    const marca = this.marcaDe.get(farola.id);
    marca?.setIcon(iconoFarola(farola, true));
    marca?.getPopup()?.update();
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
  }
}
