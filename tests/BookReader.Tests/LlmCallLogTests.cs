using System.Net;
using System.Net.Http.Json;
using BookReader.Api.Controllers;
using BookReader.Core.Llm;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace BookReader.Tests;

/// <summary>LLM call log (story S2.9): ring buffer and what the endpoints record. Fake provider, no network.</summary>
public sealed class LlmCallLogTests : ApiTestBase
{
    private readonly FakeLlmProvider _llm = new() { Chunks = ["Hel", "lo"] };

    protected override string[] QuietLogCategories => ["BookReader.Api.Filters.LlmExceptionFilter"];

    private WebApplicationFactory<Program> NewAppWithFakeLlm() =>
        NewApp().WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddScoped<ILlmProvider>(_ => _llm)));

    [Fact]
    public void Keeps_only_the_last_10_newest_first()
    {
        var log = new LlmCallLog();
        for (var i = 1; i <= 12; i++)
            log.Add(new LlmCallEntry(DateTimeOffset.UtcNow, "test", "m", $"p{i}", "a", 1, null));

        var prompts = log.GetAll().Select(e => e.Prompt).ToList();
        Assert.Equal(10, prompts.Count);
        Assert.Equal("p12", prompts[0]);
        Assert.Equal("p3", prompts[^1]);
    }

    [Fact]
    public async Task Records_full_prompt_and_answer_and_clear_empties_the_log()
    {
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();
        (await client.PostAsJsonAsync("/api/llm/test", new LlmTestRequest("hi there"))).EnsureSuccessStatusCode();

        var entries = (await client.GetFromJsonAsync<List<LlmCallEntry>>("/api/llm/log"))!;
        var entry = Assert.Single(entries);
        Assert.Equal("test", entry.Action);
        Assert.Equal("hi there", entry.Prompt);
        Assert.Equal("Hello", entry.Answer);
        Assert.Null(entry.Error);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/llm/log")).StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<List<LlmCallEntry>>("/api/llm/log"))!);
    }

    [Fact]
    public async Task Failed_calls_keep_their_error_before_and_during_the_stream()
    {
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();

        _llm.Failure = new LlmUnavailableException("Start Ollama.");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.PostAsJsonAsync("/api/llm/test", new LlmTestRequest("one"))).StatusCode);

        _llm.Failure = null;
        _llm.FailAfterChunks = new LlmUnavailableException("Connection lost.");
        (await client.PostAsJsonAsync("/api/llm/test", new LlmTestRequest("two"))).EnsureSuccessStatusCode();

        var entries = (await client.GetFromJsonAsync<List<LlmCallEntry>>("/api/llm/log"))!;
        Assert.Equal(["two", "one"], entries.Select(e => e.Prompt));
        Assert.Equal("Connection lost.", entries[0].Error);
        Assert.Equal("Hello", entries[0].Answer); // the part received before the failure is kept
        Assert.Equal("Start Ollama.", entries[1].Error);
    }

    [Fact]
    public async Task Cancelled_call_is_recorded_with_the_partial_answer()
    {
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();
        _llm.FailAfterChunks = new OperationCanceledException();

        // The cancel is rethrown to the host (no response), so the client call itself fails.
        await Assert.ThrowsAsync<HttpRequestException>(() => client.PostAsJsonAsync("/api/llm/test", new LlmTestRequest("cancel me")));

        var entry = Assert.Single((await client.GetFromJsonAsync<List<LlmCallEntry>>("/api/llm/log"))!);
        Assert.Equal("Cancelled", entry.Error);
        Assert.Equal("Hello", entry.Answer);
    }

    [Fact]
    public async Task Warm_up_is_not_recorded()
    {
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();

        // The real background warm-up path, which resolves the (fake) provider in its own scope.
        app.Services.GetRequiredService<BookReader.Api.LlmWarmUp>().Start();
        await _llm.WarmedUp.WaitAsync(TimeSpan.FromSeconds(10));

        Assert.Empty((await client.GetFromJsonAsync<List<LlmCallEntry>>("/api/llm/log"))!);
    }
}
