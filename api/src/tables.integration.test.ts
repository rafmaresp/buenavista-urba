import {
  AzureNamedKeyCredential,
  RestError,
  TableClient,
  generateAccountSas,
} from '@azure/data-tables';
import { describe, expect, it } from 'vitest';

// Integración contra Azurite. En la CI el job `api` arranca Azurite con una cuenta de clave
// aleatoria y define TABLES_CONNECTION, TABLES_ACCOUNT_NAME, TABLES_ACCOUNT_KEY y REQUIRE_AZURITE;
// en local se ejecuta lo que permitan las variables definidas.
const connection = process.env.TABLES_CONNECTION;
const accountName = process.env.TABLES_ACCOUNT_NAME;
const accountKey = process.env.TABLES_ACCOUNT_KEY;

function adminClient(tableName: string): TableClient {
  return TableClient.fromConnectionString(connection!, tableName, { allowInsecureConnection: true });
}

async function expectForbidden(operation: Promise<unknown>): Promise<void> {
  const error = await operation.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error, 'la operación debía fallar').toBeInstanceOf(RestError);
  expect((error as RestError).statusCode).toBe(403);
}

describe('Table Storage (Azurite)', () => {
  it.runIf(process.env.REQUIRE_AZURITE)('la CI tiene conexión con Azurite', () => {
    expect(connection, 'falta TABLES_CONNECTION').toBeTruthy();
    expect(accountName, 'falta TABLES_ACCOUNT_NAME').toBeTruthy();
    expect(accountKey, 'falta TABLES_ACCOUNT_KEY').toBeTruthy();
  });

  it.runIf(connection)('escribe y lee una entidad en una tabla temporal', async () => {
    const client = adminClient(`prueba${Date.now()}`);
    await client.createTable();
    try {
      await client.upsertEntity({ partitionKey: 'p', rowKey: 'r', valor: 42 });
      const entity = await client.getEntity<{ valor: number }>('p', 'r');
      expect(entity.valor).toBe(42);
    } finally {
      await client.deleteTable();
    }
  });

  // Mismo SAS que genera infra/main.bicep para TABLES_CONNECTION (ss=t, srt=o, sp=raudl).
  it.runIf(connection && accountName && accountKey)(
    'la cadena con el SAS de producción usa entidades pero no crea ni borra tablas',
    async () => {
      const tableName = `sas${Date.now()}`;
      const admin = adminClient(tableName);
      await admin.createTable();
      try {
        const sas = generateAccountSas(new AzureNamedKeyCredential(accountName!, accountKey!), {
          services: { table: true },
          resourceTypes: 'o',
          permissions: { query: true, add: true, update: true, delete: true, list: true },
          expiresOn: new Date(Date.now() + 60 * 60 * 1000),
        });
        const endpoint = `http://127.0.0.1:10002/${accountName}`;
        const sasConnection = `TableEndpoint=${endpoint};SharedAccessSignature=${sas}`;
        const app = TableClient.fromConnectionString(sasConnection, tableName, {
          allowInsecureConnection: true,
        });

        await app.createEntity({ partitionKey: 'p', rowKey: 'r', valor: 1 });
        await app.updateEntity({ partitionKey: 'p', rowKey: 'r', valor: 2 }, 'Merge');
        expect((await app.getEntity<{ valor: number }>('p', 'r')).valor).toBe(2);
        const entities = [];
        for await (const e of app.listEntities()) entities.push(e);
        expect(entities).toHaveLength(1);
        await app.deleteEntity('p', 'r');

        const otherTable = TableClient.fromConnectionString(sasConnection, `otra${Date.now()}`, {
          allowInsecureConnection: true,
        });
        await expectForbidden(otherTable.createTable());
        await expectForbidden(app.deleteTable());
      } finally {
        await admin.deleteTable();
      }
    },
  );
});
