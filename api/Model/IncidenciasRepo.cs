using Azure;
using Azure.Data.Tables;

namespace Urba.Api.Model;

public sealed class IncidenciasRepo(TableClient tabla)
{
    private int _tablaCreada;

    private async Task AsegurarTablaAsync(CancellationToken ct)
    {
        if (Volatile.Read(ref _tablaCreada) == 1) return;
        await tabla.CreateIfNotExistsAsync(ct); // idempotente: no importa si dos llamadas coinciden
        Volatile.Write(ref _tablaCreada, 1);
    }

    public async Task<List<IncidenciaEntity>> TodasAsync(CancellationToken ct)
    {
        await AsegurarTablaAsync(ct);
        var lista = new List<IncidenciaEntity>();
        await foreach (var e in tabla.QueryAsync<IncidenciaEntity>(x => x.PartitionKey == IncidenciaEntity.Particion, cancellationToken: ct))
            lista.Add(e);
        return lista.OrderByDescending(e => e.Creada).ToList();
    }

    public async Task<IncidenciaEntity?> FarolaAbiertaAsync(string farolaId, CancellationToken ct)
    {
        await AsegurarTablaAsync(ct);
        await foreach (var e in tabla.QueryAsync<IncidenciaEntity>(
            x => x.PartitionKey == IncidenciaEntity.Particion && x.FarolaId == farolaId && x.Estado != Estados.Completado,
            cancellationToken: ct))
            return e;
        return null;
    }

    public async Task<IncidenciaEntity> CrearAsync(IncidenciaEntity e, CancellationToken ct)
    {
        await AsegurarTablaAsync(ct);
        // RowKey con ticks invertidos: orden natural de más reciente a más antigua.
        e.RowKey = $"{DateTime.MaxValue.Ticks - DateTime.UtcNow.Ticks:D19}-{Guid.NewGuid().ToString("N")[..6]}";
        e.Creada = DateTimeOffset.UtcNow;
        await tabla.AddEntityAsync(e, ct);
        return e;
    }

    /// <summary>Modifica con concurrencia optimista (ETag); reintenta si otro cambio se adelanta.</summary>
    public async Task<IncidenciaEntity?> ModificarAsync(string id, Action<IncidenciaEntity> cambio, CancellationToken ct)
    {
        await AsegurarTablaAsync(ct);
        for (var intento = 0; intento < 3; intento++)
        {
            var r = await tabla.GetEntityIfExistsAsync<IncidenciaEntity>(IncidenciaEntity.Particion, id, cancellationToken: ct);
            if (!r.HasValue || r.Value is null) return null;
            var e = r.Value;
            cambio(e);
            e.Actualizada = DateTimeOffset.UtcNow;
            try
            {
                await tabla.UpdateEntityAsync(e, e.ETag, TableUpdateMode.Replace, ct);
                return e;
            }
            catch (RequestFailedException ex) when (ex.Status == 412) { }
        }
        throw new InvalidOperationException("Conflicto de concurrencia al modificar la incidencia");
    }
}
