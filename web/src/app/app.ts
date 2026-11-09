import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { RADIO_CALLE, farolaMasCercana, posibleDuplicado, tramoMasCercano } from './geo';
import { Gestion } from './gestion';
import { IncidenciasApi } from './incidencias-api';
import {
  DatosMapa, ESTADOS, Estado, Incidencia, LISTA_TIPOS, NuevaIncidencia, TIPOS, Tipo, abierta,
} from './modelos';
import { enlaceMapa, fecha } from './util';

const CENTRO: L.LatLngTuple = [37.3165, -5.9606];
const COLOR_ESTADO: Record<Estado, string> = { nuevo: '#d9480f', encurso: '#e8a200', completado: '#2b8a3e' };
const COLOR_FAROLA = '#1f3a68';
const COLOR_CALLE = '#7a8ca8';

@Component({
  selector: 'bv-root',
  imports: [FormsModule, Gestion],
  templateUrl: './app.html',
})
export class App implements AfterViewInit, OnDestroy {
  private readonly api = inject(IncidenciasApi);
  private readonly mapaEl = viewChild.required<ElementRef<HTMLDivElement>>('mapa');

  private map?: L.Map;
  private capaTramos = L.layerGroup();
  private capaFarolas = L.layerGroup();
  private capaIncid = L.layerGroup();
  private marcadorBorrador?: L.Marker;
  private datos: DatosMapa = { farolas: [], tramos: [] };
  private temporizadorAviso?: ReturnType<typeof setTimeout>;

  protected readonly esAdmin = signal(false);
  protected readonly modo = signal<'vecino' | 'gestion'>('vecino');
  protected readonly incidencias = signal<Incidencia[]>([]);
  protected readonly gestion = signal<Incidencia[]>([]);
  protected readonly borrador = signal<NuevaIncidencia | null>(null);
  protected readonly enviada = signal<Incidencia | null>(null);
  protected readonly enviando = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly calles = signal<string[]>([]);

  /** Lo que se pinta en el mapa: en gestión, todas; para vecinos, las abiertas. */
  protected readonly visibles = computed(() =>
    this.modo() === 'gestion' ? this.gestion() : this.incidencias().filter(abierta),
  );
  protected readonly abiertas = computed(() => this.incidencias().filter(abierta));

  protected readonly duplicado = computed(() => {
    const b = this.borrador();
    if (!b || !this.map) return null;
    return posibleDuplicado(this.map, this.incidencias(), b.tipo, b.farolaId, b.lat, b.lon);
  });

  protected readonly tipos = LISTA_TIPOS;
  protected readonly TIPOS = TIPOS;
  protected readonly ESTADOS = ESTADOS;
  protected readonly fecha = fecha;
  protected readonly enlaceMapa = enlaceMapa;

  constructor() {
    effect(() => {
      const inc = this.visibles();
      if (this.map) this.dibujar(inc);
    });
  }

  async ngAfterViewInit() {
    this.crearMapa();
    try {
      this.datos = await this.api.datosMapa();
      this.calles.set([...new Set(this.datos.tramos.map((t) => t.calle))]);
    } catch {
      this.mostrarAviso('No se pudo cargar el plano de la urbanización');
    }
    if (this.datos.farolas.length) {
      this.map!.fitBounds(L.latLngBounds(this.datos.farolas.map((f) => [f.lat, f.lon] as L.LatLngTuple)).pad(0.15));
    }

    const admin = await this.api.esAdmin();
    this.esAdmin.set(admin);
    if (admin && location.pathname.startsWith('/gestion')) this.modo.set('gestion');
    await this.recargar();
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  // ===== Datos =====

  protected async recargar() {
    try {
      if (this.modo() === 'gestion') this.gestion.set(await this.api.listarGestion());
      this.incidencias.set(await this.api.listar());
    } catch (e) {
      this.mostrarAviso('No se pudieron cargar las incidencias' + this.detalle(e));
    }
    this.dibujar(this.visibles());
  }

  protected async cambiarModo(m: 'vecino' | 'gestion') {
    this.cancelar();
    this.modo.set(m);
    history.replaceState(null, '', m === 'gestion' ? '/gestion' : '/');
    await this.recargar();
  }

  protected async cambiarEstado(ev: { id: string; estado: Estado }) {
    try {
      const act = await this.api.cambiarEstado(ev.id, ev.estado);
      this.gestion.update((l) => l.map((i) => (i.id === act.id ? act : i)));
      this.incidencias.update((l) => l.map((i) => (i.id === act.id ? { ...i, estado: act.estado } : i)));
      this.mostrarAviso(`Marcada como ${ESTADOS[act.estado].toLowerCase()}`);
    } catch (e) {
      this.mostrarAviso('No se pudo cambiar el estado' + this.detalle(e));
      await this.recargar();
    }
  }

  // ===== Borrador (vecino) =====

  private empezarBorrador(b: Pick<NuevaIncidencia, 'tipo' | 'lat' | 'lon'> & Partial<NuevaIncidencia>) {
    this.enviada.set(null);
    this.borrador.set({ farolaId: null, calle: null, descripcion: null, contacto: null, ...b });
    this.marcadorBorrador?.remove();
    this.marcadorBorrador = L.marker([b.lat, b.lon], {
      draggable: !b.farolaId,
      icon: L.divIcon({ className: 'marcador-borrador', iconSize: [26, 26], iconAnchor: [13, 26] }),
    }).addTo(this.map!);
    this.marcadorBorrador.on('dragend', () => {
      const p = this.marcadorBorrador!.getLatLng();
      const t = tramoMasCercano(this.map!, this.datos.tramos, p);
      this.borrador.update((d) => d && { ...d, lat: p.lat, lon: p.lng, farolaId: null, calle: t && t.d <= RADIO_CALLE ? t.calle : null });
    });
  }

  protected cambiarTipo(tipo: Tipo) {
    this.borrador.update((d) => d && { ...d, tipo, farolaId: tipo === 'farola' ? d.farolaId : null });
  }

  protected campo(nombre: 'descripcion' | 'contacto', valor: string) {
    this.borrador.update((d) => d && { ...d, [nombre]: valor });
  }

  protected cancelar() {
    this.borrador.set(null);
    this.enviada.set(null);
    this.marcadorBorrador?.remove();
    this.marcadorBorrador = undefined;
  }

  protected async enviar() {
    let b = this.borrador();
    if (!b) return;
    if (b.tipo === 'farola' && !b.farolaId) {
      const n = farolaMasCercana(this.map!, this.datos.farolas, b.lat, b.lon);
      if (!n || n.d > 25) {
        this.mostrarAviso('Toca la farola en el mapa para indicar cuál es');
        return;
      }
      b = { ...b, farolaId: n.f.id, calle: n.f.calle };
    }
    this.enviando.set(true);
    try {
      const creada = await this.api.crear(b);
      this.incidencias.update((l) => [creada, ...l]);
      this.cancelar();
      this.enviada.set(creada);
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 409 && e.error?.existente) {
        this.mostrarAviso('Esta farola ya está reportada. Puedes sumarte.');
        await this.recargar();
      } else {
        this.mostrarAviso('No se pudo enviar' + this.detalle(e));
      }
    } finally {
      this.enviando.set(false);
    }
  }

  protected async apoyar(i: Incidencia) {
    try {
      const act = await this.api.apoyar(i.id);
      this.incidencias.update((l) => l.map((x) => (x.id === act.id ? act : x)));
      this.cancelar();
      this.mostrarAviso(`Gracias. Sumado a la incidencia existente (${act.votos} vecinos).`);
    } catch (e) {
      this.mostrarAviso('No se pudo sumar' + this.detalle(e));
    }
  }

  protected textoWhatsApp(i: Incidencia) {
    const txt = `Nueva incidencia en Buenavista I:\n${TIPOS[i.tipo]}${i.farolaId ? ' ' + i.farolaId : ''}${i.calle ? ' (' + i.calle + ')' : ''}${i.descripcion ? ': ' + i.descripcion : ''}\n${enlaceMapa(i.lat, i.lon)}`;
    return 'https://wa.me/?text=' + encodeURIComponent(txt);
  }

  protected farolaDe(id: string | null) {
    return id ? this.datos.farolas.find((f) => f.id === id) : undefined;
  }

  // ===== Mapa =====

  private crearMapa() {
    const map = L.map(this.mapaEl().nativeElement, { zoomControl: true }).setView(CENTRO, 17);
    const pnoa = L.tileLayer(
      'https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&VERSION=1.0.0&Layer=OI.OrthoimageCoverage&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}',
      { maxZoom: 20, maxNativeZoom: 19, attribution: 'PNOA © IGN' },
    ).addTo(map);
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap',
    });
    L.control.layers({ 'Ortofoto PNOA': pnoa, 'Callejero OSM': osm }, {}, { collapsed: true }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    this.capaTramos.addTo(map);
    this.capaFarolas.addTo(map);
    this.capaIncid.addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => this.tocarMapa(e.latlng));
    map.on('zoomend', () => this.dibujar(this.visibles()));
    this.map = map;
  }

  private tocarMapa(ll: L.LatLng) {
    if (this.modo() !== 'vecino') return;
    const t = tramoMasCercano(this.map!, this.datos.tramos, ll);
    if (t && t.d <= RADIO_CALLE) this.empezarBorrador({ tipo: 'bache', lat: ll.lat, lon: ll.lng, calle: t.calle });
    else this.empezarBorrador({ tipo: 'otro', lat: ll.lat, lon: ll.lng });
  }

  private dibujar(incidencias: Incidencia[]) {
    const map = this.map;
    if (!map) return;
    const zoomAlto = map.getZoom() >= 18;

    this.capaTramos.clearLayers();
    for (const t of this.datos.tramos) {
      L.polyline(t.pts, { color: COLOR_CALLE, weight: 5, opacity: 0.85, interactive: false }).addTo(this.capaTramos);
      // Zona de toque ancha e invisible para acertar en la calle con el dedo.
      L.polyline(t.pts, { color: '#000', weight: 26, opacity: 0 })
        .bindTooltip(t.calle, { sticky: true })
        .on('click', (e: L.LeafletMouseEvent) => { L.DomEvent.stopPropagation(e); this.tocarMapa(e.latlng); })
        .addTo(this.capaTramos);
    }

    this.capaFarolas.clearLayers();
    for (const f of this.datos.farolas) {
      const inc = incidencias.find((i) => i.farolaId === f.id && (this.modo() === 'gestion' ? abierta(i) : true));
      if (zoomAlto) {
        L.circle([f.lat, f.lon], { radius: f.verif ? 3 : 8, weight: 0, fillOpacity: 0.12, fillColor: COLOR_FAROLA, interactive: false })
          .addTo(this.capaFarolas);
      }
      L.circleMarker([f.lat, f.lon], { radius: 8, weight: 2, color: '#fff', fillOpacity: 1, fillColor: inc ? COLOR_ESTADO[inc.estado] : COLOR_FAROLA })
        .bindTooltip(f.id, { permanent: zoomAlto, direction: 'right', className: 'lbl', offset: [6, 0] })
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          if (this.modo() === 'vecino') this.empezarBorrador({ tipo: 'farola', farolaId: f.id, calle: f.calle, lat: f.lat, lon: f.lon });
        })
        .addTo(this.capaFarolas);
    }

    this.capaIncid.clearLayers();
    for (const i of incidencias.filter((x) => !x.farolaId)) {
      const icon = L.divIcon({
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: `<div class="rombo" style="background:${COLOR_ESTADO[i.estado]}"></div>`,
      });
      const popup = document.createElement('div');
      popup.innerHTML = '<b></b><br><span></span><br><small></small>';
      popup.querySelector('b')!.textContent = TIPOS[i.tipo] + (i.calle ? ' · ' + i.calle : '');
      popup.querySelector('span')!.textContent = i.descripcion ?? '';
      popup.querySelector('small')!.textContent = `${fecha(i.creada)} · ${ESTADOS[i.estado]} · ${i.votos} vecino(s)`;
      L.marker([i.lat, i.lon], { icon }).bindPopup(popup).addTo(this.capaIncid);
    }
  }

  // ===== Utilidades =====

  private mostrarAviso(m: string) {
    this.aviso.set(m);
    clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = setTimeout(() => this.aviso.set(null), 3500);
  }

  private detalle(e: unknown) {
    if (e instanceof HttpErrorResponse) return e.error?.error ? `: ${e.error.error}` : ` (HTTP ${e.status})`;
    return '';
  }
}
