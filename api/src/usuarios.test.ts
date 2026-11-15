import { describe, expect, it } from 'vitest';
import { AltasInvalidas, esRol, normalizarEmail, parsearAltas } from './usuarios';

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

describe('parsearAltas', () => {
  function errores(texto: string): string[] {
    try {
      parsearAltas(texto);
    } catch (e) {
      expect(e).toBeInstanceOf(AltasInvalidas);
      expect((e as Error).message).not.toContain('@');
      return (e as AltasInvalidas).errores;
    }
    throw new Error('debía fallar');
  }

  it('normaliza correos, recorta espacios e ignora líneas en blanco (también CRLF)', () => {
    expect(parsearAltas('  Ana@Example.COM , directiva \r\n\r\nbea@example.com,comunero\n')).toEqual([
      { email: 'ana@example.com', rol: 'directiva' },
      { email: 'bea@example.com', rol: 'comunero' },
    ]);
  });

  it('una lista vacía no da altas', () => {
    expect(parsearAltas('\n  \n')).toEqual([]);
  });

  it('da número de línea y motivo de cada error, sin el contenido', () => {
    expect(
      errores(
        [
          'ana@example.com',
          'bea@example,comunero',
          'carla@example.com,admin',
          'dani@example.com,comunero,extra',
          'ANA@example.com,comunero',
          'ana@example.com,directiva',
          'con espacio@example.com,comunero',
        ].join('\n'),
      ),
    ).toEqual([
      'Línea 1: se esperaba "correo,rol"',
      'Línea 2: correo no válido',
      'Línea 3: rol desconocido (comunero o directiva)',
      'Línea 4: se esperaba "correo,rol"',
      'Línea 6: correo repetido con la línea 5',
      'Línea 7: correo no válido',
    ]);
  });
});
