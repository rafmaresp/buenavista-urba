import { describe, expect, it } from 'vitest';
import { LimitePeticiones } from './limite';

describe('LimitePeticiones', () => {
  it('permite el máximo por ventana, rechaza el siguiente y vuelve a permitir al pasar la ventana', () => {
    let t = 1_000;
    const limite = new LimitePeticiones(3, 60_000, () => t);
    for (let i = 0; i < 3; i++) expect(limite.consumir('a')).toEqual({ permitido: true });
    t += 15_000;
    expect(limite.consumir('a')).toEqual({ permitido: false, reintentarEnS: 45 });
    t += 45_000;
    expect(limite.consumir('a')).toEqual({ permitido: true });
  });

  it('cada clave tiene su propia cuenta', () => {
    const limite = new LimitePeticiones(1, 60_000, () => 0);
    expect(limite.consumir('a').permitido).toBe(true);
    expect(limite.consumir('a').permitido).toBe(false);
    expect(limite.consumir('b').permitido).toBe(true);
  });

  it('purga las ventanas caducadas cuando hay muchas claves', () => {
    let t = 0;
    const limite = new LimitePeticiones(1, 1_000, () => t);
    for (let i = 0; i <= 10_001; i++) limite.consumir(`k${i}`);
    t = 5_000;
    expect(limite.consumir('k0').permitido).toBe(true);
    expect((limite as unknown as { ventanas: Map<string, unknown> }).ventanas.size).toBe(1);
  });
});
