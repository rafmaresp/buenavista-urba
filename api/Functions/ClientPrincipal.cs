using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace Urba.Api.Functions;

/// <summary>Lee la cabecera x-ms-client-principal que inyecta Static Web Apps.</summary>
public static class ClientPrincipal
{
    private sealed record Principal(string[]? UserRoles);

    public static bool EsAdmin(HttpRequest req)
    {
        if (!req.Headers.TryGetValue("x-ms-client-principal", out var h) || string.IsNullOrEmpty(h)) return false;
        try
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(h!));
            var p = JsonSerializer.Deserialize<Principal>(json, JsonSerializerOptions.Web);
            return p?.UserRoles?.Contains("admin") == true;
        }
        catch (FormatException) { return false; }
        catch (JsonException) { return false; }
    }
}
