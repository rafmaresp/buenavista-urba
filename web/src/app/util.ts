export const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

export const enlaceMapa = (lat: number, lon: number) =>
  `https://maps.google.com/?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
