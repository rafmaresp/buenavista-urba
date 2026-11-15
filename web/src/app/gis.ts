import { InjectionToken } from '@angular/core';

/** Lo que usamos de Google Identity Services (https://developers.google.com/identity/gsi/web). */
export interface GoogleId {
  initialize(opciones: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }): void;
  renderButton(contenedor: HTMLElement, opciones: Record<string, string | number>): void;
}

export const URL_GIS = 'https://accounts.google.com/gsi/client';

/** Carga el script de GIS. Solo lo usa la pantalla de login (RGPD: Google recibe la IP al cargarlo). */
export type CargadorGis = () => Promise<GoogleId>;

export function cargarGis(documento: Document = document): Promise<GoogleId> {
  const global = () => (documento.defaultView as unknown as { google?: { accounts: { id: GoogleId } } }).google;
  const yaCargado = global();
  if (yaCargado) return Promise.resolve(yaCargado.accounts.id);
  return new Promise((resolve, reject) => {
    const script = documento.createElement('script');
    script.src = URL_GIS;
    script.async = true;
    script.onload = () => {
      const g = global();
      if (g) resolve(g.accounts.id);
      else reject(new Error('GIS no disponible'));
    };
    script.onerror = () => reject(new Error('GIS no disponible'));
    documento.head.appendChild(script);
  });
}

export const CARGADOR_GIS = new InjectionToken<CargadorGis>('CARGADOR_GIS', {
  providedIn: 'root',
  factory: () => () => cargarGis(),
});
