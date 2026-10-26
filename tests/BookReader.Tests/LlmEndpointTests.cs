using System.Net;
using System.Net.Http.Json;
using BookReader.Api.Controllers;
using BookReader.Core.Llm;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace BookReader.Tests;

/// <summary>LLM endpoints with a fake provider: no network, no Ollama.</summary>
public sealed class LlmEndpointTests : ApiTestBase
{
    private readonly FakeLlmProvider _llm = new();

    private WebApplicationFactory<Program> NewAppWithFakeLlm() =>
        NewApp().WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddScoped<ILlmProvider>(_ => _llm)));

    [Fact]
    public async Task Status_reports_availability_and_never_fails()
    {
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();

        _llm.Status = new LlmStatus(false, "http://x", "", "down");
        var down = await client.GetAsync("/api/llm/status");
        Assert.Equal(HttpStatusCode.OK, down.StatusCode);
        Assert.Equal("down", (await down.Content.ReadFromJsonAsync<LlmStatus>())!.Error);

        _llm.Status = new LlmStatus(true, "http://x", "m", null);
        Assert.True((await client.GetFromJsonAsync<LlmStatus>("/api/llm/status"))!.Available);
    }

    [Fact]
    public async Task Models_returns_installed_names()
    {
        _llm.Models = ["a:1b", "b:3b"];
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();

        Assert.Equal(["a:1b", "b:3b"], (await client.GetFromJsonAsync<string[]>("/api/llm/models"))!);
    }

    [Fact]
    public async Task Models_returns_503_with_hint_when_ollama_is_down()
    {
        _llm.Failure = new LlmUnavailableException("Start Ollama.");
        await AssertProblemAsync(c => c.GetAsync("/api/llm/models"), HttpStatusCode.ServiceUnavailable, "Start Ollama.");
    }

    [Fact]
    public async Task Test_streams_chunks_as_server_sent_events()
    {
        _llm.Chunks = ["Hel", "lo\nworld"];
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();

        var response = await client.PostAsJsonAsync("/api/llm/test", new LlmTestRequest("hi"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/event-stream", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("data: \"Hel\"\n\ndata: \"lo\\nworld\"\n\nevent: done\ndata: \n\n", await response.Content.ReadAsStringAsync());
        Assert.Equal("hi", _llm.LastPrompt);
    }

    [Fact]
    public async Task Test_returns_400_when_no_model_is_chosen()
    {
        _llm.Failure = new LlmNotConfiguredException("Choose a model in settings.");
        await AssertProblemAsync(c => c.PostAsJsonAsync("/api/llm/test", new LlmTestRequest("hi")),
            HttpStatusCode.BadRequest, "Choose a model in settings.");
    }

    [Fact]
    public async Task Test_returns_503_with_hint_when_ollama_is_down()
    {
        _llm.Failure = new LlmUnavailableException("Start Ollama.");
        await AssertProblemAsync(c => c.PostAsJsonAsync("/api/llm/test", new LlmTestRequest("hi")),
            HttpStatusCode.ServiceUnavailable, "Start Ollama.");
    }

    [Fact]
    public async Task Test_sends_error_event_when_model_fails_after_stream_started()
    {
        _llm.Chunks = ["partial"];
        _llm.FailAfterChunks = new LlmUnavailableException("Lost connection.");
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();

        var response = await client.PostAsJsonAsync("/api/llm/test", new LlmTestRequest("hi"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("data: \"partial\"\n\nevent: error\ndata: \"Lost connection.\"\n\n", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Test_returns_400_when_model_is_not_installed()
    {
        _llm.Failure = new LlmModelNotFoundException("llama9");
        await AssertProblemAsync(c => c.PostAsJsonAsync("/api/llm/test", new LlmTestRequest("hi")),
            HttpStatusCode.BadRequest, "Model 'llama9' is not installed. Run `ollama pull llama9` or choose another model in settings.");
    }

    [Fact]
    public async Task Test_sends_error_event_when_model_is_missing_after_stream_started()
    {
        _llm.Chunks = ["x"];
        _llm.FailAfterChunks = new LlmModelNotFoundException("llama9");
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();

        var response = await client.PostAsJsonAsync("/api/llm/test", new LlmTestRequest("hi"));

        Assert.Contains("event: error\ndata: \"Model ", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Test_sends_generic_error_event_for_unexpected_failure_after_stream_started()
    {
        _llm.Chunks = ["x"];
        _llm.FailAfterChunks = new InvalidOperationException("secret internals");
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();

        var body = await (await client.PostAsJsonAsync("/api/llm/test", new LlmTestRequest("hi"))).Content.ReadAsStringAsync();

        Assert.Contains("event: error", body);
        Assert.DoesNotContain("secret internals", body);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Test_returns_400_for_blank_prompt(string prompt)
    {
        await AssertProblemAsync(c => c.PostAsJsonAsync("/api/llm/test", new LlmTestRequest(prompt)),
            HttpStatusCode.BadRequest, "Prompt must not be empty.");
    }

    [Fact]
    public async Task Translate_streams_translation_with_default_ukrainian_prompt()
    {
        _llm.Chunks = ["Hi-uk"];
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();

        var response = await client.PostAsJsonAsync("/api/llm/translate", new TranslateRequest("Hello", "Hello, world."));

        Assert.Equal("text/event-stream", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("data: \"Hi-uk\"\n\nevent: done\ndata: \n\n", await response.Content.ReadAsStringAsync());
        Assert.Contains("into Ukrainian", _llm.LastPrompt);
        Assert.Contains("Hello", _llm.LastPrompt);
        Assert.DoesNotContain("Hello, world.", _llm.LastPrompt);
    }

    [Fact]
    public async Task Translate_reads_target_language_from_settings_on_each_call()
    {
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();
        await client.PutAsJsonAsync("/api/settings", new Dictionary<string, string> { ["language.native"] = "German" });

        await client.PostAsJsonAsync("/api/llm/translate", new TranslateRequest("Hello"));

        Assert.Contains("into German", _llm.LastPrompt);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Translate_returns_400_for_blank_text(string text)
    {
        await AssertProblemAsync(c => c.PostAsJsonAsync("/api/llm/translate", new TranslateRequest(text)),
            HttpStatusCode.BadRequest, "Text must not be empty.");
    }

    [Fact]
    public async Task Translate_returns_400_when_no_model_is_chosen()
    {
        _llm.Failure = new LlmNotConfiguredException("Choose a model in settings.");
        await AssertProblemAsync(c => c.PostAsJsonAsync("/api/llm/translate", new TranslateRequest("Hello")),
            HttpStatusCode.BadRequest, "Choose a model in settings.");
    }

    [Fact]
    public async Task Translate_returns_503_with_hint_when_ollama_is_down()
    {
        _llm.Failure = new LlmUnavailableException("Start Ollama.");
        await AssertProblemAsync(c => c.PostAsJsonAsync("/api/llm/translate", new TranslateRequest("Hello")),
            HttpStatusCode.ServiceUnavailable, "Start Ollama.");
    }

    [Fact]
    public async Task Translate_returns_400_when_native_language_is_blank()
    {
        await AssertProblemAsync(async c =>
        {
            await c.PutAsJsonAsync("/api/settings", new Dictionary<string, string> { ["language.native"] = " " });
            return await c.PostAsJsonAsync("/api/llm/translate", new TranslateRequest("Hello"));
        }, HttpStatusCode.BadRequest, "Set your native language in settings.");
    }

    private async Task AssertProblemAsync(Func<HttpClient, Task<HttpResponseMessage>> call, HttpStatusCode status, string detail)
    {
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();

        var response = await call(client);

        Assert.Equal(status, response.StatusCode);
        Assert.Equal(detail, (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }
}
