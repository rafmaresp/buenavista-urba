import { TableClient } from '@azure/data-tables';

/** Tablas que usa la API. Deben coincidir con las de infra/main.bicep (lo comprueba tablas.test.ts). */
export const TABLAS = ['Farolas', 'Auditoria', 'Usuarios', 'Incidencias'] as const;
export type Tabla = (typeof TABLAS)[number];

/** App setting con la cadena de conexión (SAS de servicio) de cada tabla. */
export function variableDeConexion(tabla: Tabla): string {
  return `${tabla.toUpperCase()}_CONNECTION`;
}

/**
 * Cliente de una tabla a partir de su app setting (`FAROLAS_CONNECTION`, `AUDITORIA_CONNECTION`, `USUARIOS_CONNECTION`, `INCIDENCIAS_CONNECTION`).
 * El error nunca incluye el valor: lleva un SAS.
 */
export function tablaClient(tabla: Tabla, env: NodeJS.ProcessEnv = process.env): TableClient {
  const variable = variableDeConexion(tabla);
  const conexion = env[variable];
  if (!conexion) {
    throw new Error(`Falta el app setting ${variable}`);
  }
  // Azurite (local y CI) va por http; en Azure el SAS exige https.
  const allowInsecureConnection = conexion.includes('http://127.0.0.1') || conexion.includes('http://localhost');
  return TableClient.fromConnectionString(conexion, tabla, { allowInsecureConnection });
}
