import { TableClient } from '@azure/data-tables';
import { describe, expect, it } from 'vitest';

// Integración contra Azurite. En la CI el job `api` arranca Azurite y define
// TABLES_CONNECTION y REQUIRE_AZURITE; en local se ejecuta si TABLES_CONNECTION existe.
const connection = process.env.TABLES_CONNECTION;

describe('Table Storage (Azurite)', () => {
  it.runIf(process.env.REQUIRE_AZURITE)('la CI tiene conexión con Azurite', () => {
    expect(connection, 'falta TABLES_CONNECTION').toBeTruthy();
  });

  it.runIf(connection)('escribe y lee una entidad en una tabla temporal', async () => {
    const tableName = `prueba${Date.now()}`;
    const client = TableClient.fromConnectionString(connection!, tableName, {
      allowInsecureConnection: true,
    });
    await client.createTable();
    try {
      await client.upsertEntity({ partitionKey: 'p', rowKey: 'r', valor: 42 });
      const entity = await client.getEntity<{ valor: number }>('p', 'r');
      expect(entity.valor).toBe(42);
    } finally {
      await client.deleteTable();
    }
  });
});
