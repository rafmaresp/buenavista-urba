import { describe, expect, it } from 'vitest';
import { esRol, normalizarEmail } from './usuarios';

describe('usuarios', () => {
  it('normaliza el email quitando espacios y pasando a minúsculas', () => {
    expect(normalizarEmail('  Vecina@Example.COM ')).toBe('vecina@example.com');
  });

  it('solo comunero y directiva son roles', () => {
    expect(esRol('comunero')).toBe(true);
    expect(esRol('directiva')).toBe(true);
    expect(esRol('admin')).toBe(false);
    expect(esRol('')).toBe(false);
  });
});
