import { Injectable, signal } from '@angular/core';

// Tipos mínimos de Google Identity Services (https://developers.google.com/identity/gsi/web).
interface CredentialResponse { credential: string; }
interface GsiId {
  initialize(cfg: { client_id: string; callback: (r: CredentialResponse) => void; auto_select?: boolean }): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
  disableAutoSelect(): void;
}
declare global { interface Window { google?: { accounts: { id: GsiId } } } }

const CLAVE = 'bv1_google_token';

/** Login de la junta con Google. El ID token se valida en la API (Google.Apis.Auth). */
@Injectable({ providedIn: 'root' })
export class GoogleAuth {
  readonly token = signal<string | null>(this.leerGuardado());
  readonly email = signal<string | null>(this.token() ? emailDe(this.token()!) : null);

  private cargado?: Promise<void>;

  /** Carga el script de GIS, inicializa con el client ID y pinta el botón en el elemento. */
  async pintarBoton(el: HTMLElement, clientId: string) {
    await this.cargarScript();
    const gsi = window.google!.accounts.id;
    gsi.initialize({ client_id: clientId, callback: (r) => this.guardar(r.credential) });
    gsi.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'es' });
  }

  salir() {
    window.google?.accounts.id.disableAutoSelect();
    this.guardar(null);
  }

  private guardar(t: string | null) {
    try {
      if (t) sessionStorage.setItem(CLAVE, t); else sessionStorage.removeItem(CLAVE);
    } catch { /* sin almacenamiento: solo en memoria */ }
    this.token.set(t);
    this.email.set(t ? emailDe(t) : null);
  }

  private leerGuardado(): string | null {
    try {
      const t = sessionStorage.getItem(CLAVE);
      return t && !caducado(t) ? t : null;
    } catch {
      return null;
    }
  }

  private cargarScript() {
    this.cargado ??= new Promise<void>((ok, ko) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => ko(new Error('No se pudo cargar el login de Google'));
      document.head.appendChild(s);
    });
    return this.cargado;
  }
}

function payload(t: string): { email?: string; exp?: number } {
  try {
    const b = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0))));
  } catch {
    return {};
  }
}
const emailDe = (t: string) => payload(t).email ?? null;
const caducado = (t: string) => (payload(t).exp ?? 0) * 1000 < Date.now() + 60_000;
