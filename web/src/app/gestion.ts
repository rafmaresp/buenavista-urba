import { Component, computed, input, output, signal } from '@angular/core';
import { ESTADOS, Estado, Incidencia, LISTA_ESTADOS, LISTA_TIPOS, TIPOS, Tipo } from './modelos';
import { enlaceMapa, fecha } from './util';

type FiltroEstado = 'activas' | Estado;

/** Panel de la junta (rol admin): todas las incidencias, filtros y cambio de estado. */
@Component({
  selector: 'bv-gestion',
  template: `
    <div class="eyebrow">Panel de gestión (junta)</div>
    <h2>Incidencias</h2>
    <div class="stats">
      @for (e of estados; track e) {
        <div><span class="hint">{{ ESTADOS[e] }}</span><b [class]="'st-' + e">{{ cuenta()[e] }}</b></div>
      }
    </div>
    <div class="filtros">
      <label>Estado
        <select [value]="fEstado()" (change)="fEstado.set($any($event.target).value)">
          <option value="activas">Activas (nuevo + en curso)</option>
          @for (e of estados; track e) { <option [value]="e">{{ ESTADOS[e] }}</option> }
        </select>
      </label>
      <label>Tipo
        <select [value]="fTipo()" (change)="fTipo.set($any($event.target).value)">
          <option value="">Todos</option>
          @for (t of tipos; track t) { <option [value]="t">{{ TIPOS[t] }}</option> }
        </select>
      </label>
      <label>Calle
        <select [value]="fCalle()" (change)="fCalle.set($any($event.target).value)">
          <option value="">Todas</option>
          @for (c of calles(); track c) { <option [value]="c">{{ c }}</option> }
        </select>
      </label>
    </div>
    <p class="hint">{{ lista().length }} de {{ incidencias().length }} incidencias</p>
    @for (i of lista(); track i.id) {
      <article class="card">
        <div class="card-top">
          <b>{{ TIPOS[i.tipo] }}{{ i.farolaId ? ' ' + i.farolaId : '' }}</b>
          <span class="badge" [class]="'badge st-' + i.estado">{{ ESTADOS[i.estado] }}</span>
        </div>
        <div class="hint">{{ i.calle || 'Sin calle' }} · {{ fecha(i.creada) }} · {{ i.votos }} {{ i.votos === 1 ? 'vecino' : 'vecinos' }}</div>
        @if (i.descripcion) { <p>«{{ i.descripcion }}»</p> }
        @if (i.contacto) { <p class="hint">Contacto: {{ i.contacto }}</p> }
        <div class="row">
          <select [value]="i.estado" (change)="cambiar.emit({ id: i.id, estado: $any($event.target).value })" aria-label="Cambiar estado">
            @for (e of estados; track e) { <option [value]="e">{{ ESTADOS[e] }}</option> }
          </select>
          <a class="btn small" [href]="enlaceMapa(i.lat, i.lon)" target="_blank" rel="noopener">Ver en Maps</a>
        </div>
      </article>
    } @empty {
      <p class="hint">No hay incidencias con estos filtros.</p>
    }
  `,
})
export class Gestion {
  readonly incidencias = input.required<Incidencia[]>();
  readonly calles = input.required<string[]>();
  readonly cambiar = output<{ id: string; estado: Estado }>();

  protected readonly fEstado = signal<FiltroEstado>('activas');
  protected readonly fTipo = signal<Tipo | ''>('');
  protected readonly fCalle = signal('');

  protected readonly cuenta = computed(() => {
    const c: Record<Estado, number> = { nuevo: 0, encurso: 0, completado: 0 };
    for (const i of this.incidencias()) c[i.estado]++;
    return c;
  });

  protected readonly lista = computed(() => {
    const fe = this.fEstado(), ft = this.fTipo(), fc = this.fCalle();
    return this.incidencias().filter(
      (i) =>
        (fe === 'activas' ? i.estado !== 'completado' : i.estado === fe) &&
        (!ft || i.tipo === ft) &&
        (!fc || i.calle === fc),
    );
  });

  protected readonly estados = LISTA_ESTADOS;
  protected readonly tipos = LISTA_TIPOS;
  protected readonly ESTADOS = ESTADOS;
  protected readonly TIPOS = TIPOS;
  protected readonly fecha = fecha;
  protected readonly enlaceMapa = enlaceMapa;
}
