using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BookReader.Tests;

/// <summary>Shared setup for API tests: an isolated temp data folder (never the real data/) and a host factory for it.</summary>
public abstract class ApiTestBase : IDisposable
{
    protected string DataFolderPath { get; } = Path.Combine(Path.GetTempPath(), "bookreader-tests-" + Guid.NewGuid());

    /// <summary>Starts a new host on the same data folder; call it twice to simulate an app restart.</summary>
    protected WebApplicationFactory<Program> NewApp() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseSetting("DataFolder", DataFolderPath);
            // Tests only: drop host/EF Core info logs; real warnings and errors still show.
            // Must be config, not SetMinimumLevel: appsettings.json's Logging:LogLevel:Default filter rule overrides it.
            b.UseSetting("Logging:LogLevel:Default", "Warning");
        });

    public void Dispose()
    {
        // SQLite pooling may keep the file locked briefly; cleanup is best effort.
        try { Directory.Delete(DataFolderPath, true); } catch (IOException) { }
    }
}
