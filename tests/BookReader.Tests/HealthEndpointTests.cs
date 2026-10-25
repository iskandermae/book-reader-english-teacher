using System.Net.Http.Json;
using BookReader.Api.Controllers;
using BookReader.Core.Data;

namespace BookReader.Tests;

public sealed class HealthEndpointTests : ApiTestBase
{
    [Fact]
    public async Task Health_returns_ok_and_creates_database()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/health");

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("ok", (await response.Content.ReadFromJsonAsync<HealthResponse>())!.Status);
        Assert.True(File.Exists(DataFolder.DatabasePath(DataFolderPath)));
    }
}
