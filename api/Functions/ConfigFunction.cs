using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace Urba.Api.Functions;

/// <summary>Configuración pública para el front (el client ID de Google no es secreto).</summary>
public sealed class ConfigFunction(AuthGoogle auth)
{
    [Function("Config")]
    public IActionResult Config(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "config")] HttpRequest req) =>
        new OkObjectResult(new { googleClientId = auth.ClientId });
}
