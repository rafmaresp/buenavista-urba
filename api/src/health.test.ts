import { beforeEach, describe, expect, it, vi } from 'vitest';
import { health } from './health';

describe('health', () => {
  it('responde 200, {"estado":"ok"} y Cache-Control: no-store', () => {
    const res = health();
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.jsonBody)).toBe('{"estado":"ok"}');
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
});

describe('registro en el host', () => {
  const http = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    http.mockClear();
    vi.doMock('@azure/functions', () => ({ app: { http } }));
    await import('./functions/health');
  });

  it('ruta health, solo GET, anónima', () => {
    expect(http).toHaveBeenCalledTimes(1);
    const [name, options] = http.mock.calls[0]!;
    expect(name).toBe('health');
    expect(options).toMatchObject({ route: 'health', methods: ['GET'], authLevel: 'anonymous' });
  });
});
