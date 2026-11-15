// Alta de usuarios en la lista cerrada (specs/007-alta-usuarios). La lanza el workflow "Desplegar
// infraestructura (Bicep)" con USUARIOS_ALTA (secreto del entorno infra: "correo,rol" por línea),
// USUARIOS_CONNECTION (rad: deshacer un alta cuya auditoría falle) y AUDITORIA_CONNECTION (a),
// SAS de servicio de 1 h. Uso:
//   node dist/scripts/cargar-usuarios.js
// Solo imprime recuentos y números de línea (y el uid de un alta sin auditar): nunca correos ni cadenas de conexión.
import { cargarUsuarios } from '../carga-usuarios';
import { tablaClient } from '../tablas';
import { AltasInvalidas, parsearAltas } from '../usuarios';
import { RepositorioUsuarios } from '../usuarios-repo';

async function main(): Promise<void> {
  const texto = process.env.USUARIOS_ALTA ?? '';
  if (!texto.trim()) {
    console.log('Sin USUARIOS_ALTA: no se da de alta a nadie.');
    return;
  }
  const lista = parsearAltas(texto);
  const repo = new RepositorioUsuarios(tablaClient('Usuarios'), tablaClient('Auditoria'));
  const resultado = await cargarUsuarios(repo, lista);
  console.log(`Lista: ${lista.length} usuarios. Ya existían: ${resultado.existentes}. Altas: ${resultado.altas}.`);
}

main().catch((e: unknown) => {
  if (e instanceof AltasInvalidas) {
    for (const error of e.errores) console.error(error);
    console.error('La carga ha fallado: lista de altas inválida (no se ha escrito nada).');
  } else {
    const error = e as { name?: string; message?: string; statusCode?: number };
    // Un RestError puede llevar la URL con el SAS en el mensaje: solo nombre y código.
    const detalle = error.statusCode ? `${error.name} ${error.statusCode}` : `${error.name}: ${error.message}`;
    console.error(`La carga ha fallado: ${detalle}`);
  }
  process.exit(1);
});
