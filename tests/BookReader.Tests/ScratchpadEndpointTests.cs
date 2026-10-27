using System.Net;
using System.Net.Http.Json;
using BookReader.Api.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace BookReader.Tests;

public sealed class ScratchpadEndpointTests : ApiTestBase
{
    private const int Limit = 200_000;

    [Fact]
    public async Task Never_saved_scratchpad_is_empty()
    {
        await using var app = NewApp();
        using var client = app.CreateClient();

        var pad = await client.GetFromJsonAsync<ScratchpadDto>("/api/scratchpad");

        Assert.Equal("", pad!.Text);
    }

    [Fact]
    public async Task Saved_text_survives_an_app_restart_and_is_replaced_by_the_next_save()
    {
        await using (var app = NewApp())
        {
            using var client = app.CreateClient();
            Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync("/api/scratchpad", new ScratchpadDto("first"))).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync("/api/scratchpad", new ScratchpadDto("second"))).StatusCode);
        }

        await using var restarted = NewApp(); // new host, same data folder
        using var client2 = restarted.CreateClient();
        Assert.Equal("second", (await client2.GetFromJsonAsync<ScratchpadDto>("/api/scratchpad"))!.Text);
    }

    [Fact]
    public async Task Empty_text_clears_the_scratchpad()
    {
        await using var app = NewApp();
        using var client = app.CreateClient();
        await client.PutAsJsonAsync("/api/scratchpad", new ScratchpadDto("something"));

        var put = await client.PutAsJsonAsync("/api/scratchpad", new ScratchpadDto(""));

        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        Assert.Equal("", (await client.GetFromJsonAsync<ScratchpadDto>("/api/scratchpad"))!.Text);
    }

    [Fact]
    public async Task Text_at_the_limit_is_saved()
    {
        await using var app = NewApp();
        using var client = app.CreateClient();

        var put = await client.PutAsJsonAsync("/api/scratchpad", new ScratchpadDto(new string('a', Limit)));

        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        Assert.Equal(Limit, (await client.GetFromJsonAsync<ScratchpadDto>("/api/scratchpad"))!.Text.Length);
    }

    [Fact]
    public async Task Text_over_the_limit_returns_400_and_keeps_the_old_text()
    {
        await using var app = NewApp();
        using var client = app.CreateClient();
        await client.PutAsJsonAsync("/api/scratchpad", new ScratchpadDto("keep me"));

        var put = await client.PutAsJsonAsync("/api/scratchpad", new ScratchpadDto(new string('a', Limit + 1)));

        Assert.Equal(HttpStatusCode.BadRequest, put.StatusCode);
        var problem = await put.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Contains("too long", problem!.Detail);
        Assert.Equal("keep me", (await client.GetFromJsonAsync<ScratchpadDto>("/api/scratchpad"))!.Text);
    }
}
