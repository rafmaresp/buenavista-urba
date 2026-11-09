using Azure;
using Azure.Data.Tables;

namespace Urba.Api.Model;

public static class Tipos
{
    public static readonly HashSet<string> Validos = ["farola", "bache", "fuga", "otro"];
}

public static class Estados
{
    public const string Nuevo = "nuevo", EnCurso = "encurso", Completado = "completado";
    public static readonly HashSet<string> Validos = [Nuevo, EnCurso, Completado];
}

public sealed class IncidenciaEntity : ITableEntity
{
    public const string Tabla = "Incidencias";
    public const string Particion = "bv1";

    public string PartitionKey { get; set; } = Particion;
    public string RowKey { get; set; } = default!;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string Tipo { get; set; } = default!;
    public string? FarolaId { get; set; }
    public string? Calle { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public string? Descripcion { get; set; }
    /// <summary>Contacto opcional del vecino. Solo se expone en /api/gestion.</summary>
    public string? Contacto { get; set; }
    public string Estado { get; set; } = Estados.Nuevo;
    public int Votos { get; set; } = 1;
    public DateTimeOffset Creada { get; set; }
    public DateTimeOffset? Actualizada { get; set; }
}

/// <summary>Lo que ven los vecinos: nunca incluye el contacto.</summary>
public sealed record IncidenciaPublica(
    string Id, string Tipo, string? FarolaId, string? Calle, double Lat, double Lon,
    string? Descripcion, string Estado, int Votos, DateTimeOffset Creada)
{
    public static IncidenciaPublica De(IncidenciaEntity e) =>
        new(e.RowKey, e.Tipo, e.FarolaId, e.Calle, e.Lat, e.Lon, e.Descripcion, e.Estado, e.Votos, e.Creada);
}

/// <summary>Vista de gestión (rol admin): incluye el contacto.</summary>
public sealed record IncidenciaGestion(
    string Id, string Tipo, string? FarolaId, string? Calle, double Lat, double Lon,
    string? Descripcion, string Estado, int Votos, DateTimeOffset Creada, DateTimeOffset? Actualizada, string? Contacto)
{
    public static IncidenciaGestion De(IncidenciaEntity e) =>
        new(e.RowKey, e.Tipo, e.FarolaId, e.Calle, e.Lat, e.Lon, e.Descripcion, e.Estado, e.Votos, e.Creada, e.Actualizada, e.Contacto);
}

public sealed record NuevaIncidencia(
    string? Tipo, string? FarolaId, string? Calle, double Lat, double Lon, string? Descripcion, string? Contacto);

public sealed record CambioEstado(string? Estado);
