using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;

namespace BookReader.Tests;

public sealed class SettingsEndpointTests : ApiTestBase
{
    [Fact]
    public async Task Saved_values_survive_an_app_restart()
    {
        await using (var app = NewApp())
        {
            using var client = app.CreateClient();
            var put = await client.PutAsJsonAsync("/api/settings", new Dictionary<string, string> { ["ui.sample"] = "hello" });
            Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        }

        await using (var restarted = NewApp()) // new host, same data folder
        {
            using var client = restarted.CreateClient();
            var all = await client.GetFromJsonAsync<Dictionary<string, string>>("/api/settings");
            Assert.Equal("hello", all!["ui.sample"]);
            Assert.Equal("", all["ollama.model"]);
        }
    }

    [Fact]
    public async Task Put_with_unknown_key_returns_400_with_message()
    {
        await AssertRejectedAsync(new Dictionary<string, string?> { ["nope"] = "x" }, "Unknown setting 'nope'");
    }

    [Fact]
    public async Task Put_with_1001_chars_returns_400_and_saves_nothing()
    {
        await AssertRejectedAsync(new Dictionary<string, string?> { ["ui.sample"] = new string('a', 1001) }, "too long");
    }

    [Fact]
    public async Task Put_with_null_value_returns_400_and_saves_nothing()
    {
        await AssertRejectedAsync(new Dictionary<string, string?> { ["ui.sample"] = null }, "must not be null");
    }

    [Fact]
    public async Task Put_with_bad_reader_value_returns_400_and_saves_nothing()
    {
        await AssertRejectedAsync(new Dictionary<string, string?> { ["reader.theme"] = "blue" }, "'reader.theme' must be one of");
    }

    private async Task AssertRejectedAsync(Dictionary<string, string?> body, string expectedDetail)
    {
        await using var app = NewApp();
        using var client = app.CreateClient();

        var response = await client.PutAsJsonAsync("/api/settings", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("Invalid settings", problem!.Title);
        Assert.Contains(expectedDetail, problem.Detail);
        var all = await client.GetFromJsonAsync<Dictionary<string, string>>("/api/settings");
        Assert.Equal("", all!["ui.sample"]);
    }
}
