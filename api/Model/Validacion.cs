namespace Urba.Api.Model;

public static class Validacion
{
    // Caja que envuelve Buenavista I con margen; fuera de ella se rechaza.
    private const double LatMin = 37.305, LatMax = 37.330, LonMin = -5.975, LonMax = -5.945;
    public const int MaxDescripcion = 500, MaxContacto = 100, MaxCalle = 80;

    public static string? Errores(NuevaIncidencia n)
    {
        if (n.Tipo is null || !Tipos.Validos.Contains(n.Tipo)) return "Tipo no válido";
        if (n.Lat is < LatMin or > LatMax || n.Lon is < LonMin or > LonMax) return "La ubicación está fuera de la urbanización";
        if (n.Tipo == "farola" && string.IsNullOrWhiteSpace(n.FarolaId)) return "Indica la farola";
        if (n.FarolaId is { Length: > 5 }) return "Farola no válida";
        if (n.Descripcion is { Length: > MaxDescripcion }) return $"La descripción supera {MaxDescripcion} caracteres";
        if (n.Contacto is { Length: > MaxContacto }) return $"El contacto supera {MaxContacto} caracteres";
        if (n.Calle is { Length: > MaxCalle }) return "Calle no válida";
        return null;
    }

    public static string? Limpio(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
