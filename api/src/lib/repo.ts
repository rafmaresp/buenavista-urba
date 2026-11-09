import { randomUUID } from 'node:crypto';
import { RestError, TableClient, odata } from '@azure/data-tables';
import { IncidenciaEntity } from './modelos';

const TABLA = 'Incidencias';
export const PARTICION = 'bv1';

let cliente: TableClient | undefined;
let tablaLista = false;

function tabla(): TableClient {
  if (!cliente) {
    const conn = process.env['TablesConnection'];
    if (!conn) throw new Error('Falta el app setting TablesConnection');
    const local = conn.includes('UseDevelopmentStorage=true') || conn.includes('127.0.0.1');
    cliente = TableClient.fromConnectionString(conn, TABLA, { allowInsecureConnection: local });
  }
  return cliente;
}

async function asegurarTabla() {
  if (tablaLista) return;
  await tabla().createTable(); // no falla si ya existe
  tablaLista = true;
}

/** Copia solo los campos del modelo (descarta etag, timestamp y metadatos OData). */
function limpia(e: IncidenciaEntity): IncidenciaEntity {
  return {
    partitionKey: e.partitionKey, rowKey: e.rowKey, tipo: e.tipo, farolaId: e.farolaId, calle: e.calle,
    lat: e.lat, lon: e.lon, descripcion: e.descripcion, contacto: e.contacto, estado: e.estado,
    votos: e.votos, creada: e.creada, actualizada: e.actualizada,
  };
}

export async function todas(): Promise<IncidenciaEntity[]> {
  await asegurarTabla();
  const lista: IncidenciaEntity[] = [];
  const it = tabla().listEntities<IncidenciaEntity>({ queryOptions: { filter: odata`PartitionKey eq ${PARTICION}` } });
  for await (const e of it) lista.push(limpia(e));
  return lista.sort((a, b) => b.creada.localeCompare(a.creada));
}

export async function farolaAbierta(farolaId: string): Promise<IncidenciaEntity | undefined> {
  await asegurarTabla();
  const it = tabla().listEntities<IncidenciaEntity>({
    queryOptions: { filter: odata`PartitionKey eq ${PARTICION} and farolaId eq ${farolaId} and estado ne ${'completado'}` },
  });
  for await (const e of it) return limpia(e);
  return undefined;
}

export async function crear(datos: Omit<IncidenciaEntity, 'partitionKey' | 'rowKey' | 'estado' | 'votos' | 'creada'>) {
  await asegurarTabla();
  const ahora = Date.now();
  // RowKey con tiempo invertido: orden natural de más reciente a más antigua.
  const rowKey = `${String(8_640_000_000_000_000 - ahora).padStart(16, '0')}-${randomUUID().slice(0, 6)}`;
  const e: IncidenciaEntity = {
    ...datos, partitionKey: PARTICION, rowKey, estado: 'nuevo', votos: 1, creada: new Date(ahora).toISOString(),
  };
  await tabla().createEntity(limpia(e));
  return e;
}

/** Modifica con concurrencia optimista (ETag); reintenta si otro cambio se adelanta. */
export async function modificar(id: string, cambio: (e: IncidenciaEntity) => void): Promise<IncidenciaEntity | null> {
  await asegurarTabla();
  for (let intento = 0; intento < 3; intento++) {
    let actual;
    try {
      actual = await tabla().getEntity<IncidenciaEntity>(PARTICION, id);
    } catch (err) {
      if (err instanceof RestError && err.statusCode === 404) return null;
      throw err;
    }
    const e = limpia(actual);
    cambio(e);
    e.actualizada = new Date().toISOString();
    try {
      await tabla().updateEntity(e, 'Replace', { etag: actual.etag });
      return e;
    } catch (err) {
      if (!(err instanceof RestError && err.statusCode === 412)) throw err;
    }
  }
  throw new Error('Conflicto de concurrencia al modificar la incidencia');
}
