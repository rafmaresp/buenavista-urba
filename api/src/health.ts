export interface HealthResponse {
  status: number;
  headers: Record<string, string>;
  jsonBody: { estado: 'ok' };
}

/** Respuesta pura de /api/health: sin I/O, sin versión, sin almacenamiento. */
export function health(): HealthResponse {
  return {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
    jsonBody: { estado: 'ok' },
  };
}
