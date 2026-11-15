// Alta de usuarios en la lista cerrada (specs/007-alta-usuarios). La lanza el workflow "Desplegar
// infraestructura (Bicep)" con USUARIOS_ALTA (secreto del entorno infra: "correo,rol" por línea),
// USUARIOS_CONNECTION (rad: deshacer un alta cuya auditoría falle) y AUDITORIA_CONNECTION (a),
// SAS de servicio de 1 h. Uso:
//   node dist/scripts/cargar-usuarios.js
// La lógica y sus tests están en carga-usuarios.ts (ejecutarCargaUsuarios).
import { ejecutarCargaUsuarios } from '../carga-usuarios';
import { tablaClient } from '../tablas';
import { RepositorioUsuarios } from '../usuarios-repo';

void ejecutarCargaUsuarios(process.env, () => new RepositorioUsuarios(tablaClient('Usuarios'), tablaClient('Auditoria'))).then(
  ({ salida, errores, codigo }) => {
    for (const linea of salida) console.log(linea);
    for (const linea of errores) console.error(linea);
    process.exitCode = codigo;
  },
);
