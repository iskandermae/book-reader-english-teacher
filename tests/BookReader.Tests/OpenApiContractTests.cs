namespace BookReader.Tests;

/// <summary>
/// Guards api/openapi.json (the contract the frontend client is generated from).
/// Regenerate with: set UPDATE_OPENAPI=1 and run this test (see api/README.md).
/// </summary>
public sealed class OpenApiContractTests : ApiTestBase
{
    private const string UpdateVariable = "UPDATE_OPENAPI";

    [Fact]
    public async Task Committed_contract_matches_generated_one()
    {
        var generated = Normalize(await GenerateAsync());
        var path = Path.Combine(FindRepoRoot(), "api", "openapi.json");

        if (Environment.GetEnvironmentVariable(UpdateVariable) == "1")
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await File.WriteAllTextAsync(path, generated);
            return;
        }

        Assert.True(File.Exists(path), $"api/openapi.json is missing. {RegenerateHint}");
        Assert.True(generated == Normalize(await File.ReadAllTextAsync(path)),
            $"api/openapi.json is stale. {RegenerateHint}");
    }

    [Fact]
    public async Task Contract_contains_health_endpoint()
    {
        Assert.Contains("\"/api/health\"", await GenerateAsync());
    }

    private static string RegenerateHint =>
        $"Regenerate it: set {UpdateVariable}=1 and run `dotnet test --filter OpenApiContractTests` (see api/README.md), then commit the file.";

    private async Task<string> GenerateAsync()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        return await client.GetStringAsync("/openapi/v1.json");
    }

    // Line endings must not matter (git autocrlf on Windows); the file always ends with one newline.
    private static string Normalize(string text) => text.Replace("\r\n", "\n").TrimEnd() + "\n";

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "BookReader.sln")))
            dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Repo root (BookReader.sln) not found.");
    }

}
