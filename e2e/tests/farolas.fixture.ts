import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

export interface FarolaPublica {
  id: string;
  calle: string;
  lat: number;
  lon: number;
}

/**
 * Las 70 farolas públicas leídas de la semilla (data/farolas_buenavista.csv), sin la precisión.
 * El job e2e no tiene Azurite ni catálogo sembrado: la API real se prueba en api/ contra Azurite.
 */
export function farolasDeLaSemilla(): FarolaPublica[] {
  const texto = readFileSync(join(__dirname, '..', '..', 'data', 'farolas_buenavista.csv'), 'utf8');
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).slice(1);
  const fin = lineas.findIndex((l) => l.trim() === '');
  return (fin === -1 ? lineas : lineas.slice(0, fin)).map((linea) => {
    const [numero, calle, lat, lon] = linea.split(',');
    return { id: `F${numero!.padStart(2, '0')}`, calle: calle!, lat: Number(lat), lon: Number(lon) };
  });
}

/** Responde /api/farolas con el estado y cuerpo dados (por defecto, las 70 farolas). */
export async function simularApiFarolas(page: Page, respuesta: { status: number; body: unknown } = { status: 200, body: { farolas: farolasDeLaSemilla() } }) {
  await page.route('**/api/farolas', (ruta) =>
    ruta.fulfill({ status: respuesta.status, contentType: 'application/json', body: JSON.stringify(respuesta.body) }),
  );
}

/** Responde GET /api/incidencias (por defecto, ninguna abierta). El POST sigue yendo a la API real. */
export async function simularApiIncidencias(page: Page, incidencias: unknown[] = []) {
  await page.route('**/api/incidencias', (ruta) =>
    ruta.request().method() === 'GET'
      ? ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ incidencias }) })
      : ruta.continue(),
  );
}

/** Teselas de IGN y OSM vacías: la CI no depende de servidores externos. */
export async function teselasSinRed(page: Page) {
  const vacia = { status: 204, body: '' };
  await page.route('https://www.ign.es/**', (ruta) => ruta.fulfill(vacia));
  await page.route('https://tile.openstreetmap.org/**', (ruta) => ruta.fulfill(vacia));
}

/**
 * Entra como directiva sin Google ni usuarios reales: un Google Identity Services falso (su botón
 * llama al callback con un token de prueba), /api/config con un client ID y /api/yo con rol
 * directiva. Solo prueba la web; la API real exige un token de Google válido (api/ y Azurite).
 */
export async function entrarComoDirectiva(page: Page) {
  await page.addInitScript(() => {
    let callback: ((r: { credential: string }) => void) | undefined;
    (window as unknown as { google: unknown }).google = {
      accounts: {
        id: {
          initialize: (o: { callback: (r: { credential: string }) => void }) => {
            callback = o.callback;
          },
          renderButton: (contenedor: HTMLElement) => {
            const boton = document.createElement('button');
            boton.type = 'button';
            boton.textContent = 'Entrar (prueba)';
            boton.addEventListener('click', () => callback?.({ credential: 'token-de-prueba' }));
            contenedor.append(boton);
          },
        },
      },
    };
  });
  await page.route('**/api/config', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ googleClientId: 'cliente-prueba' }) }),
  );
  await page.route('**/api/yo', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uid: 'u', rol: 'directiva' }) }),
  );
  await page.goto('/login');
  await page.getByRole('button', { name: 'Entrar (prueba)' }).click();
  await page.getByRole('link', { name: 'Ir al inicio' }).click();
}
