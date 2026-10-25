using BookReader.Api.Filters;
using BookReader.Core.Data;
using BookReader.Core.Settings;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// All app data lives in a "data" folder beside the executable ("DataFolder" setting overrides it, e.g. in tests).
var dataFolder = DataFolder.Resolve(builder.Configuration["DataFolder"]);
Directory.CreateDirectory(dataFolder);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddScoped<SettingsValidationExceptionFilter>();
builder.Services.AddScoped<ISettingsService, SettingsService>();
builder.Services.AddDbContext<AppDbContext>(options =>
    // Migrations live in the Api assembly because it is the startup project for `dotnet ef`.
    options.UseSqlite($"Data Source={DataFolder.DatabasePath(dataFolder)}",
        sqlite => sqlite.MigrationsAssembly(typeof(Program).Assembly.GetName().Name)));

var app = builder.Build();

// First start creates the empty database; later starts apply new migrations.
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();
}

app.MapControllers();
app.MapOpenApi(); // serves /openapi/v1.json; api/openapi.json is generated from it (see api/README.md)

app.Run();

// Makes Program visible to WebApplicationFactory in tests.
public partial class Program;
