using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Urba.Api.Model;

namespace Urba.Api.Functions;

/// <summary>Endpoints públicos para vecinos. Nunca devuelven el contacto.</summary>
public sealed class IncidenciasFunctions(IncidenciasRepo repo)
{
    [Function("ListarIncidencias")]
    public async Task<IActionResult> Listar(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "incidencias")] HttpRequest req, CancellationToken ct)
    {
        var todas = await repo.TodasAsync(ct);
        return new OkObjectResult(todas.Select(IncidenciaPublica.De));
    }

    [Function("CrearIncidencia")]
    public async Task<IActionResult> Crear(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "incidencias")] HttpRequest req, CancellationToken ct)
    {
        NuevaIncidencia? n;
        try { n = await req.ReadFromJsonAsync<NuevaIncidencia>(ct); }
        catch (System.Text.Json.JsonException) { return new BadRequestObjectResult(new { error = "JSON no válido" }); }
        if (n is null) return new BadRequestObjectResult(new { error = "Cuerpo vacío" });
        if (Validacion.Errores(n) is { } err) return new BadRequestObjectResult(new { error = err });

        var farolaId = n.Tipo == "farola" ? Validacion.Limpio(n.FarolaId) : null;
        if (farolaId is not null && await repo.FarolaAbiertaAsync(farolaId, ct) is { } ya)
            return new ConflictObjectResult(new { error = "Esta farola ya está reportada", existente = IncidenciaPublica.De(ya) });

        var e = await repo.CrearAsync(new IncidenciaEntity
        {
            Tipo = n.Tipo!,
            FarolaId = farolaId,
            Calle = Validacion.Limpio(n.Calle),
            Lat = Math.Round(n.Lat, 7),
            Lon = Math.Round(n.Lon, 7),
            Descripcion = Validacion.Limpio(n.Descripcion),
            Contacto = Validacion.Limpio(n.Contacto),
        }, ct);
        // TODO: aviso por correo a la junta (siguiente PR).
        return new ObjectResult(IncidenciaPublica.De(e)) { StatusCode = StatusCodes.Status201Created };
    }

    [Function("ApoyarIncidencia")]
    public async Task<IActionResult> Apoyar(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "incidencias/{id}/apoyos")] HttpRequest req, string id, CancellationToken ct)
    {
        var e = await repo.ModificarAsync(id, x => x.Votos++, ct);
        return e is null ? new NotFoundResult() : new OkObjectResult(IncidenciaPublica.De(e));
    }
}
