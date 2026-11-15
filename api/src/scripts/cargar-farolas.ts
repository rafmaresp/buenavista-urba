// Carga (siembra) del catálogo de farolas. La lanza el workflow "Desplegar infraestructura (Bicep)" con
// FAROLAS_CONNECTION (rad: deshacer un alta si su auditoría falla) y AUDITORIA_CONNECTION (a),
// SAS de servicio de 1 h. Uso:
//   node dist/scripts/cargar-farolas.js ../data/farolas_buenavista.csv
// Solo imprime recuentos e ids de farola: nunca las cadenas de conexión.
import { readFileSync } from 'node:fs';
import { cargarFarolas } from '../carga-farolas';
import { parsearSemilla } from '../farolas';
import { RepositorioFarolas } from '../farolas-repo';
import { tablaClient } from '../tablas';

async function main(): Promise<void> {
  const ruta = process.argv[2];
  if (!ruta) throw new Error('Uso: cargar-farolas <ruta del CSV>');

  const semilla = parsearSemilla(readFileSync(ruta, 'utf8'));
  const repo = new RepositorioFarolas(tablaClient('Farolas'), tablaClient('Auditoria'));
  const resultado = await cargarFarolas(repo, semilla);
  console.log(`Semilla: ${semilla.length} farolas. Ya existían: ${resultado.existentes}.`);
  console.log(`Altas: ${resultado.altas.length}${resultado.altas.length ? ` (${resultado.altas.join(', ')})` : ''}.`);
}

main().catch((e: unknown) => {
  const error = e as { name?: string; message?: string; statusCode?: number };
  // Un RestError puede llevar la URL con el SAS en el mensaje: solo nombre y código.
  const detalle = error.statusCode ? `${error.name} ${error.statusCode}` : `${error.name}: ${error.message}`;
  console.error(`La carga ha fallado: ${detalle}`);
  process.exit(1);
});
