import { Component, ElementRef, OnDestroy, afterNextRender, inject, input, signal, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { Sesion } from '../sesion';
import { CENTRO, ZOOM_ETIQUETAS, ZOOM_INICIAL, crearCapasBase } from './capas';
import { ErrorReubicar, FarolaPublica, cargarFarolas, reubicarFarola } from './farolas-cliente';
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

/** Guarda la nueva posición de una farola (PUT /api/farolas/{id}); si falla, lanza (ErrorReubicar). */
export type Reubicar = (id: string, lat: number, lon: number) => Promise<FarolaPublica>;

/** Farola en modo mover: arrastrándola, esperando confirmación o guardando. */
export interface Movimiento {
  id: string;
  fase: 'arrastrando' | 'confirmar' | 'guardando';
}

/** Mensaje tras guardar o fallar al mover. */
export interface AvisoMover {
  texto: string;
  error: boolean;
}

export interface OpcionesFicha {
  incidencia?: IncidenciaPublica;
  /** Hay sesión: se muestra el formulario de aviso. */
  dentro: boolean;
  /** Envía el aviso con el comentario escrito; si falla, lanza (ErrorAviso). */
  avisar?: (comentario: string) => Promise<void>;
  /** Solo para la directiva: pone la farola en modo mover (specs/008). */
  mover?: () => void;
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

function botonMover(mover: () => void): HTMLButtonElement {
  const boton = elemento('button', 'ficha__mover', 'Mover farola');
  boton.type = 'button';
  boton.addEventListener('click', mover);
  return boton;
}

function mensajeErrorMover(e: unknown): string {
  const motivo = e instanceof ErrorReubicar ? e.motivo : 'no-disponible';
  switch (motivo) {
    case 'sin-sesion':
      return 'Tu sesión ha caducado o no tienes permiso. Vuelve a entrar. La farola no se ha movido.';
    case 'cambiada':
      return 'Otra persona ha movido esta farola. Recarga el mapa y vuelve a intentarlo.';
    case 'no-valido':
      return 'Esa posición no es válida: tiene que quedar dentro de la urbanización.';
    default:
      return 'No se pudo guardar la nueva posición. Inténtalo de nuevo.';
  }
}

/** 7 decimales ≈ 1 cm: suficiente y sin ruido del arrastre. */
function redondear(grados: number): number {
  return Math.round(grados * 1e7) / 1e7;
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
  if (opciones.mover) ficha.append(botonMover(opciones.mover));
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

  /** Por defecto PUT /api/farolas/{id} con el token de la sesión (specs/008). */
  readonly reubicar = input<Reubicar>((id, lat, lon) =>
    reubicarFarola((url, init) => this.sesion.llamar(url, init), id, lat, lon),
  );

  protected readonly estado = signal<EstadoCarga>('cargando');
  readonly movimiento = signal<Movimiento | null>(null);
  readonly avisoMover = signal<AvisoMover | null>(null);
  /** Posición de la farola en modo mover antes de arrastrarla: a ella vuelve si se cancela o falla. */
  private desde?: L.LatLng;
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
    this.cancelarMover();
    this.avisoMover.set(null);
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
      // Solo muestra el control: quien decide es la API (constitución IV).
      mover: this.sesion.rol() === 'directiva' ? () => this.empezarMover(farola.id) : undefined,
    });
  }

  /** Modo mover: solo esta marca se puede arrastrar; al soltarla se pide confirmación. */
  empezarMover(id: string): void {
    this.cancelarMover();
    const marca = this.marcaDe.get(id);
    if (!marca?.dragging) return;
    this.avisoMover.set(null);
    this.desde = marca.getLatLng();
    marca.closePopup();
    marca.dragging.enable();
    marca.on('dragend', () => this.movimiento.set({ id, fase: 'confirmar' }));
    this.movimiento.set({ id, fase: 'arrastrando' });
  }

  /** Guarda la posición en la que se soltó la marca; si falla, la marca vuelve a su sitio. */
  async guardar(): Promise<void> {
    const movimiento = this.movimiento();
    const marca = movimiento && this.marcaDe.get(movimiento.id);
    if (!movimiento || movimiento.fase !== 'confirmar' || !marca) return;
    this.movimiento.set({ ...movimiento, fase: 'guardando' });
    marca.dragging?.disable();
    const { lat, lng } = marca.getLatLng();
    try {
      const movida = await this.reubicar()(movimiento.id, redondear(lat), redondear(lng));
      marca.setLatLng([movida.lat, movida.lon]);
      this.desde = undefined;
      this.avisoMover.set({ texto: `${movimiento.id} se ha movido.`, error: false });
    } catch (e) {
      this.avisoMover.set({ texto: mensajeErrorMover(e), error: true });
    }
    this.cancelarMover();
  }

  /** Sale del modo mover y devuelve la marca a donde estaba (si no se guardó). */
  cancelarMover(): void {
    const movimiento = this.movimiento();
    if (!movimiento) return;
    const marca = this.marcaDe.get(movimiento.id);
    marca?.dragging?.disable();
    marca?.off('dragend');
    if (this.desde) marca?.setLatLng(this.desde);
    this.desde = undefined;
    this.movimiento.set(null);
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
