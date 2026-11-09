using Azure.Data.Tables;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Urba.Api.Model;

var builder = FunctionsApplication.CreateBuilder(args);
builder.ConfigureFunctionsWebApplication();

builder.Services.AddSingleton(_ =>
{
    var conn = Environment.GetEnvironmentVariable("TablesConnection")
        ?? throw new InvalidOperationException("Falta el app setting TablesConnection");
    return new TableClient(conn, IncidenciaEntity.Tabla);
});
builder.Services.AddSingleton<IncidenciasRepo>();
builder.Services.AddSingleton<Urba.Api.Functions.AuthGoogle>();

builder.Build().Run();
