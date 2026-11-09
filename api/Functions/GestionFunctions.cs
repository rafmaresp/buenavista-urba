using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Urba.Api.Model;

namespace Urba.Api.Functions;

/// <summary>
/// Endpoints de la junta. SWA ya exige el rol admin en /api/gestion/* (staticwebapp.config.json);
/// aquí se comprueba otra vez por si la API se expone sin SWA delante.
/// La ruta no puede empezar por "admin": está reservada por el host de Functions.
/// </summary>
public sealed class GestionFunctions(IncidenciasRepo repo)
{
    [Function("GestionListar")]
    public async Task<IActionResult> Listar(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "gestion/incidencias")] HttpRequest req, CancellationToken ct)
    {
        if (!ClientPrincipal.EsAdmin(req)) return new StatusCodeResult(StatusCodes.Status403Forbidden);
        var todas = await repo.TodasAsync(ct);
        return new OkObjectResult(todas.Select(IncidenciaGestion.De));
    }

    [Function("GestionCambiarEstado")]
    public async Task<IActionResult> CambiarEstado(
        [HttpTrigger(AuthorizationLevel.Anonymous, "patch", Route = "gestion/incidencias/{id}")] HttpRequest req, string id, CancellationToken ct)
    {
        if (!ClientPrincipal.EsAdmin(req)) return new StatusCodeResult(StatusCodes.Status403Forbidden);
        CambioEstado? c;
        try { c = await req.ReadFromJsonAsync<CambioEstado>(ct); }
        catch (System.Text.Json.JsonException) { return new BadRequestObjectResult(new { error = "JSON no válido" }); }
        if (c?.Estado is null || !Estados.Validos.Contains(c.Estado))
            return new BadRequestObjectResult(new { error = "Estado no válido" });

        var e = await repo.ModificarAsync(id, x => x.Estado = c.Estado, ct);
        return e is null ? new NotFoundResult() : new OkObjectResult(IncidenciaGestion.De(e));
    }
}
