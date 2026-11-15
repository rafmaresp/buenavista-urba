/**
 * Límite de peticiones por usuario: ventana fija, en memoria de la instancia (research.md sec. 6).
 * Basta para el tráfico de la urbanización y no cuesta transacciones de Storage.
 */
export type ResultadoLimite = { permitido: true } | { permitido: false; reintentarEnS: number };

export class LimitePeticiones {
  private readonly ventanas = new Map<string, { inicio: number; usadas: number }>();

  constructor(
    private readonly maximo = 60,
    private readonly ventanaMs = 60_000,
    private readonly ahora: () => number = Date.now,
  ) {}

  consumir(clave: string): ResultadoLimite {
    const t = this.ahora();
    if (this.ventanas.size > 10_000) this.purgar(t);
    let ventana = this.ventanas.get(clave);
    if (!ventana || t - ventana.inicio >= this.ventanaMs) {
      ventana = { inicio: t, usadas: 0 };
      this.ventanas.set(clave, ventana);
    }
    if (ventana.usadas >= this.maximo) {
      return { permitido: false, reintentarEnS: Math.ceil((ventana.inicio + this.ventanaMs - t) / 1000) };
    }
    ventana.usadas++;
    return { permitido: true };
  }

  private purgar(t: number): void {
    for (const [clave, v] of this.ventanas) if (t - v.inicio >= this.ventanaMs) this.ventanas.delete(clave);
  }
}
