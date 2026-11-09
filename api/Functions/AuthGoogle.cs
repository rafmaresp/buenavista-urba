using Google.Apis.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Urba.Api.Functions;

/// <summary>
/// Login de la junta con Google Identity Services. El front manda el ID token de Google en la cabecera
/// <see cref="Cabecera"/>; aquí se valida firma, audiencia (GOOGLE_CLIENT_ID) y caducidad, y se comprueba
/// que el email verificado está en ADMIN_EMAILS (lista separada por comas).
/// Se usa una cabecera propia en vez de Authorization para que SWA no la toque.
/// </summary>
public sealed class AuthGoogle(ILogger<AuthGoogle> log)
{
    public const string Cabecera = "X-Urba-Token";

    private readonly string? _clientId = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID");
    private readonly HashSet<string> _admins = new(
        (Environment.GetEnvironmentVariable("ADMIN_EMAILS") ?? "")
            .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
        StringComparer.OrdinalIgnoreCase);

    public string? ClientId => _clientId;

    public async Task<bool> EsAdminAsync(HttpRequest req)
    {
        if (string.IsNullOrEmpty(_clientId)) return false;
        if (!req.Headers.TryGetValue(Cabecera, out var token) || string.IsNullOrWhiteSpace(token)) return false;
        try
        {
            var p = await GoogleJsonWebSignature.ValidateAsync(token!,
                new GoogleJsonWebSignature.ValidationSettings { Audience = [_clientId] });
            return p.EmailVerified && p.Email is not null && _admins.Contains(p.Email);
        }
        catch (InvalidJwtException ex)
        {
            log.LogInformation("Token de Google rechazado: {Motivo}", ex.Message);
            return false;
        }
    }
}
