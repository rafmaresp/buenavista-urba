// Ayudas para las pruebas de integración contra Azurite (solo las importan los *.integration.test.ts).
// En la CI el job `api` arranca Azurite con una cuenta de clave aleatoria y define TABLES_CONNECTION
// (conexión de administración), TABLES_ACCOUNT_NAME, TABLES_ACCOUNT_KEY y REQUIRE_AZURITE.
import { AzureNamedKeyCredential, RestError, TableClient, type TableSasPermissions, generateTableSas } from '@azure/data-tables';
import { expect } from 'vitest';

export const conexionAdmin = process.env.TABLES_CONNECTION;
const accountName = process.env.TABLES_ACCOUNT_NAME;
const accountKey = process.env.TABLES_ACCOUNT_KEY;

/** Hay Azurite con nombre y clave: se pueden firmar SAS como los de producción. */
export const hayAzuriteConClave = Boolean(conexionAdmin && accountName && accountKey);

export function clienteAdmin(tabla: string): TableClient {
  return TableClient.fromConnectionString(conexionAdmin!, tabla, { allowInsecureConnection: true });
}

/** SAS de servicio de una tabla, como los de FAROLAS_CONNECTION y AUDITORIA_CONNECTION. */
export function sasDeTabla(tabla: string, permisos: TableSasPermissions): string {
  return generateTableSas(tabla, new AzureNamedKeyCredential(accountName!, accountKey!), {
    permissions: permisos,
    expiresOn: new Date(Date.now() + 60 * 60 * 1000),
  });
}

/** Cliente de `tabla` con la cadena de conexión que usa la app (TableEndpoint + SAS). */
export function clienteConCadenaSas(tabla: string, sas: string): TableClient {
  const conexion = `TableEndpoint=http://127.0.0.1:10002/${accountName};SharedAccessSignature=${sas}`;
  return TableClient.fromConnectionString(conexion, tabla, { allowInsecureConnection: true });
}

export function clienteConSas(tabla: string, permisos: TableSasPermissions): TableClient {
  return clienteConCadenaSas(tabla, sasDeTabla(tabla, permisos));
}

/** Crea tablas temporales con nombre único, ejecuta la prueba y las borra. */
export async function conTablasTemporales<T>(
  prefijos: string[],
  prueba: (nombres: string[]) => Promise<T>,
): Promise<T> {
  const sufijo = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const nombres = prefijos.map((p) => `${p}${sufijo}`);
  await Promise.all(nombres.map((n) => clienteAdmin(n).createTable()));
  try {
    return await prueba(nombres);
  } finally {
    await Promise.all(nombres.map((n) => clienteAdmin(n).deleteTable()));
  }
}

export async function esperarProhibido(operacion: Promise<unknown>): Promise<void> {
  const error = await operacion.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error, 'la operación debía fallar').toBeInstanceOf(RestError);
  expect((error as RestError).statusCode).toBe(403);
}

export async function contar(cliente: TableClient): Promise<number> {
  let n = 0;
  for await (const _ of cliente.listEntities()) n++;
  return n;
}
