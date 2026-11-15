import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CARGADOR_GIS } from '../gis';
import { Sesion } from '../sesion';

type Estado = 'cargando' | 'listo' | 'sin-acceso' | 'no-disponible';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.html',
})
export class Login implements OnInit {
  protected readonly sesion = inject(Sesion);
  private readonly cargarGis = inject(CARGADOR_GIS);
  private readonly boton = viewChild.required<ElementRef<HTMLElement>>('boton');
  protected readonly estado = signal<Estado>('cargando');

  async ngOnInit(): Promise<void> {
    try {
      const config = (await (await fetch('/api/config')).json()) as { googleClientId?: string };
      if (!config.googleClientId) throw new Error('Sin client ID');
      const gis = await this.cargarGis();
      gis.initialize({
        client_id: config.googleClientId,
        callback: ({ credential }) => void this.alEntrar(credential),
      });
      gis.renderButton(this.boton().nativeElement, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'es' });
      this.estado.set('listo');
    } catch {
      this.estado.set('no-disponible');
    }
  }

  private async alEntrar(credencial: string): Promise<void> {
    const resultado = await this.sesion.entrar(credencial);
    this.estado.set(resultado === 'ok' ? 'listo' : resultado);
  }
}
