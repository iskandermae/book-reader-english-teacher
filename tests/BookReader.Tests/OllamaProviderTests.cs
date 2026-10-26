using BookReader.Core.Llm;
using BookReader.Core.Settings;

namespace BookReader.Tests;

public sealed class OllamaProviderTests
{
    // Port 1 on localhost refuses the connection at once: a deterministic "Ollama is down" without any real server.
    private const string DeadUrl = "http://127.0.0.1:1";

    [Fact]
    public async Task Status_when_server_is_down_does_not_throw_and_gives_a_hint()
    {
        var status = await Provider(DeadUrl, "m").GetStatusAsync();

        Assert.False(status.Available);
        Assert.Equal(DeadUrl, status.Url);
        Assert.Contains("Start Ollama", status.Error);
    }

    [Fact]
    public async Task Models_when_server_is_down_throws_unavailable()
    {
        await Assert.ThrowsAsync<LlmUnavailableException>(() => Provider(DeadUrl, "m").ListModelsAsync());
    }

    [Fact]
    public async Task Generate_without_a_model_throws_not_configured()
    {
        await Assert.ThrowsAsync<LlmNotConfiguredException>(async () =>
        {
            await foreach (var _ in Provider(DeadUrl, "").GenerateAsync("hi")) { }
        });
    }

    [Fact]
    public async Task Generate_when_server_is_down_throws_unavailable()
    {
        await Assert.ThrowsAsync<LlmUnavailableException>(async () =>
        {
            await foreach (var _ in Provider(DeadUrl, "m").GenerateAsync("hi")) { }
        });
    }

    // A tiny local HTTP server plays Ollama, so the real OllamaSharp error handling is covered without Ollama.
    [Fact]
    public async Task Generate_with_unknown_model_throws_model_not_found()
    {
        using var server = FakeOllamaServer.Start(404, """{"error":"model 'nope' not found"}""");

        var ex = await Assert.ThrowsAsync<LlmModelNotFoundException>(async () =>
        {
            await foreach (var _ in Provider(server.Url, "nope").GenerateAsync("hi")) { }
        });
        Assert.Contains("ollama pull nope", ex.Message);
    }

    [Fact]
    public async Task Generate_with_server_error_throws_unavailable()
    {
        using var server = FakeOllamaServer.Start(500, """{"error":"boom"}""");

        await Assert.ThrowsAsync<LlmUnavailableException>(async () =>
        {
            await foreach (var _ in Provider(server.Url, "m").GenerateAsync("hi")) { }
        });
    }

    [Theory]
    [InlineData(500, """{"error":"boom"}""")]
    [InlineData(200, "this is not json")]
    public async Task Status_never_throws_whatever_the_server_answers(int code, string body)
    {
        using var server = FakeOllamaServer.Start(code, body);

        var status = await Provider(server.Url, "m").GetStatusAsync();

        Assert.False(status.Available);
        Assert.False(string.IsNullOrEmpty(status.Error));
    }

    internal static OllamaProvider Provider(string url, string model) => new(new FixedSettings(url, model));

    internal sealed class FixedSettings(string url, string model) : ISettingsService
    {
        public Task<IReadOnlyDictionary<string, string>> GetAllAsync(CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyDictionary<string, string>>(new Dictionary<string, string>
            {
                [SettingsService.OllamaUrl] = url,
                [SettingsService.OllamaModel] = model,
            });

        public Task<IReadOnlyDictionary<string, string>> UpdateAsync(IReadOnlyDictionary<string, string?> values, CancellationToken ct = default) =>
            throw new NotSupportedException();
    }
}

/// <summary>Answers every request with a fixed status and body, on a free loopback port.</summary>
internal sealed class FakeOllamaServer : IDisposable
{
    private readonly System.Net.HttpListener _listener = new();

    public string Url { get; }

    private FakeOllamaServer(string url) => Url = url;

    public static FakeOllamaServer Start(int status, string body)
    {
        // HttpListener cannot bind port 0, so try random ports until one is free.
        for (var attempt = 0; ; attempt++)
        {
            var url = $"http://127.0.0.1:{Random.Shared.Next(20000, 60000)}/";
            var server = new FakeOllamaServer(url);
            server._listener.Prefixes.Add(url);
            try { server._listener.Start(); }
            catch (System.Net.HttpListenerException) when (attempt < 20) { continue; }
            _ = server.ServeAsync(status, body);
            return server;
        }
    }

    private async Task ServeAsync(int status, string body)
    {
        try
        {
            while (true)
            {
                var context = await _listener.GetContextAsync();
                context.Response.StatusCode = status;
                context.Response.ContentType = "application/json";
                await context.Response.OutputStream.WriteAsync(System.Text.Encoding.UTF8.GetBytes(body));
                context.Response.Close();
            }
        }
        catch (Exception) { /* listener closed: test is over */ }
    }

    public void Dispose() => _listener.Close();
}

/// <summary>
/// Needs a running local Ollama with at least one model; excluded from the default run.
/// Run: set RUN_OLLAMA_INTEGRATION=1 (optional OLLAMA_URL, OLLAMA_MODEL), then `dotnet test --filter Category=Integration`.
/// </summary>
public sealed class OllamaProviderIntegrationTests
{
    private sealed class OllamaFactAttribute : FactAttribute
    {
        public OllamaFactAttribute()
        {
            if (Environment.GetEnvironmentVariable("RUN_OLLAMA_INTEGRATION") != "1")
                Skip = "Set RUN_OLLAMA_INTEGRATION=1 to run (needs local Ollama).";
        }
    }

    [OllamaFact, Trait("Category", "Integration")]
    public async Task Real_ollama_lists_models_and_streams_text()
    {
        var url = Environment.GetEnvironmentVariable("OLLAMA_URL") ?? "http://localhost:11434";
        var models = await OllamaProviderTests.Provider(url, "").ListModelsAsync();
        Assert.NotEmpty(models);

        var model = Environment.GetEnvironmentVariable("OLLAMA_MODEL") ?? models[0];
        var text = "";
        await foreach (var chunk in OllamaProviderTests.Provider(url, model).GenerateAsync("Say hello in one word."))
            text += chunk;
        Assert.NotEmpty(text);
    }
}
