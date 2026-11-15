import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Constitución IV: toda Function que no sea pública por diseño identifica en cada petición.
const PUBLICAS = new Set(['health.ts', 'farolas.ts', 'config.ts']);
const dir = join(__dirname, 'functions');

describe('Functions', () => {
  const ficheros = readdirSync(dir).filter((f) => f.endsWith('.ts'));

  it.each(ficheros.filter((f) => !PUBLICAS.has(f)))('%s usa depsIdentidad (identificar en cada petición)', (f) => {
    expect(readFileSync(join(dir, f), 'utf8')).toMatch(/depsIdentidad\(/);
  });

  it('las públicas son exactamente las previstas', () => {
    expect(ficheros.filter((f) => PUBLICAS.has(f)).sort()).toEqual([...PUBLICAS].sort());
  });
});
