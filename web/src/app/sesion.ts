import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

export type Rol = 'comunero' | 'directiva';
export type ResultadoEntrada = 'ok' | 'sin-acceso' | 'no-disponible';

/**
 * Sesión en el navegador (spec 005-login-roles): el ID token de Google solo vive en memoria
 * (nunca en localStorage ni cookies) y se envía en cada llamada no pública en `X-Id-Token`.
 * El rol que se guarda aquí solo sirve para mostrar u ocultar controles: lo decide la API.
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly router = inject(Router);
  private readonly token = signal<string | null>(null);
  readonly rol = signal<Rol | null>(null);
  readonly dentro = computed(() => this.rol() !== null);

  /** Valida el token con GET /api/yo; si la API lo acepta, queda guardado en memoria. */
  async entrar(token: string): Promise<ResultadoEntrada> {
    this.token.set(token);
    const respuesta = await this.llamar('/api/yo').catch(() => null);
    if (respuesta?.ok) {
      const { rol } = (await respuesta.json()) as { rol: Rol };
      this.rol.set(rol);
      return 'ok';
    }
    this.salir();
    return respuesta && (respuesta.status === 401 || respuesta.status === 403) ? 'sin-acceso' : 'no-disponible';
  }

  salir(): void {
    this.token.set(null);
    this.rol.set(null);
  }

  /** fetch con el token; un 401 con sesión abierta (token caducado) la cierra y lleva a /login. */
  async llamar(url: string, init: RequestInit = {}): Promise<Response> {
    const token = this.token();
    const headers = new Headers(init.headers);
    if (token) headers.set('X-Id-Token', token);
    const respuesta = await fetch(url, { ...init, headers });
    if (respuesta.status === 401 && this.dentro()) {
      this.salir();
      void this.router.navigateByUrl('/login');
    }
    return respuesta;
  }
}
