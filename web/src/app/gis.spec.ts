import { URL_GIS, cargarGis } from './gis';

describe('cargarGis', () => {
  afterEach(() => {
    document.head.querySelectorAll(`script[src="${URL_GIS}"]`).forEach((s) => s.remove());
    delete (window as unknown as { google?: unknown }).google;
  });

  it('añade el script de Google y resuelve con google.accounts.id al cargar', async () => {
    const promesa = cargarGis(document);
    const script = document.head.querySelector<HTMLScriptElement>(`script[src="${URL_GIS}"]`)!;
    expect(script).toBeTruthy();
    const id = { initialize: () => {}, renderButton: () => {} };
    (window as unknown as { google: unknown }).google = { accounts: { id } };
    script.onload!(new Event('load'));
    expect(await promesa).toBe(id);
  });

  it('si ya está cargado no añade otro script', async () => {
    const id = { initialize: () => {}, renderButton: () => {} };
    (window as unknown as { google: unknown }).google = { accounts: { id } };
    expect(await cargarGis(document)).toBe(id);
    expect(document.head.querySelector(`script[src="${URL_GIS}"]`)).toBeNull();
  });

  it('falla si el script no carga o no define google', async () => {
    const p1 = cargarGis(document);
    document.head.querySelector<HTMLScriptElement>(`script[src="${URL_GIS}"]`)!.onerror!(new Event('error'));
    await expect(p1).rejects.toThrow('GIS no disponible');
    document.head.querySelectorAll('script').forEach((s) => s.remove());
    const p2 = cargarGis(document);
    document.head.querySelector<HTMLScriptElement>(`script[src="${URL_GIS}"]`)!.onload!(new Event('load'));
    await expect(p2).rejects.toThrow('GIS no disponible');
  });
});
