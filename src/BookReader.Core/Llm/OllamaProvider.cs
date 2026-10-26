using System.Runtime.CompilerServices;
using BookReader.Core.Settings;
using OllamaSharp;
using OllamaSharp.Models;
using OllamaSharp.Models.Exceptions;

namespace BookReader.Core.Llm;

/// <summary>
/// Ollama implementation (decisions D5, D6). Url and model are read from settings on every call,
/// so a change in settings applies at once, without a restart.
/// </summary>
public class OllamaProvider(ISettingsService settings, HttpMessageHandler? handler = null) : ILlmProvider
{
    // Short limit for quick checks only; generation itself can legitimately take minutes.
    private static readonly TimeSpan CheckTimeout = TimeSpan.FromSeconds(5);

    // One handler for all calls keeps connections pooled although the client is created per call (the url can change).
    private static readonly SocketsHttpHandler SharedHandler = new() { PooledConnectionLifetime = TimeSpan.FromMinutes(2) };

    public async Task<LlmStatus> GetStatusAsync(CancellationToken ct = default)
    {
        var (url, model) = await ReadSettingsAsync(ct);
        try
        {
            await ListModelsAsync(ct);
            return new LlmStatus(true, url, model, null);
        }
        catch (LlmException ex)
        {
            return new LlmStatus(false, url, model, ex.Message);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The status check must never fail, whatever the server answers.
            return new LlmStatus(false, url, model, $"Unexpected error from Ollama: {ex.Message}");
        }
    }

    public async Task<IReadOnlyList<string>> ListModelsAsync(CancellationToken ct = default)
    {
        var (url, _) = await ReadSettingsAsync(ct);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(CheckTimeout);
        try
        {
            var models = await CreateClient(url, "").ListLocalModelsAsync(timeout.Token);
            return models.Select(m => m.Name).ToList();
        }
        catch (Exception ex) when (IsOllamaProblem(ex, ct))
        {
            throw Translate(ex, url, "");
        }
    }

    public async IAsyncEnumerable<string> GenerateAsync(string prompt, [EnumeratorCancellation] CancellationToken ct = default)
    {
        var (url, model) = await ReadSettingsAsync(ct);
        if (string.IsNullOrWhiteSpace(model))
            throw new LlmNotConfiguredException("Choose a model in settings.");

        var request = new GenerateRequest { Model = model, Prompt = prompt };
        await using var chunks = CreateClient(url, model).GenerateAsync(request, ct).GetAsyncEnumerator(ct);
        while (true)
        {
            // "yield" is not allowed inside try/catch, so only the MoveNext call is guarded.
            bool hasNext;
            try
            {
                hasNext = await chunks.MoveNextAsync();
            }
            catch (Exception ex) when (IsOllamaProblem(ex, ct))
            {
                throw Translate(ex, url, model);
            }
            if (!hasNext)
                yield break;
            if (!string.IsNullOrEmpty(chunks.Current?.Response))
                yield return chunks.Current.Response;
        }
    }

    private async Task<(string Url, string Model)> ReadSettingsAsync(CancellationToken ct)
    {
        var all = await settings.GetAllAsync(ct);
        return (all[SettingsService.OllamaUrl], all[SettingsService.OllamaModel]);
    }

    // The handler is shared, so the HttpClient must not dispose it. The url is validated when it is saved.
    // The optional handler lets tests replace the network.
    private OllamaApiClient CreateClient(string url, string model) =>
        new(new HttpClient(handler ?? SharedHandler, disposeHandler: false)
        {
            BaseAddress = new Uri(url),
            Timeout = Timeout.InfiniteTimeSpan, // long generations; callers cancel through the token
        }, model);

    // A caller cancel must stay a cancel. Everything else from the wire is an Ollama problem:
    // refused connection, our own check timeout, or a non-2xx answer (OllamaSharp throws OllamaException with the server's text).
    private static bool IsOllamaProblem(Exception ex, CancellationToken callerToken) =>
        ex is HttpRequestException or OllamaException
        || (ex is OperationCanceledException && !callerToken.IsCancellationRequested);

    private static LlmException Translate(Exception ex, string url, string model)
    {
        // Streaming calls fail with HttpRequestException carrying the status code (404 = unknown model);
        // other calls fail with OllamaException, which has only the server text ("model '<name>' not found").
        var notFound = ex is HttpRequestException { StatusCode: System.Net.HttpStatusCode.NotFound }
            || (ex is OllamaException && ex.Message.Contains("not found", StringComparison.OrdinalIgnoreCase));
        if (notFound && model != "")
            return new LlmModelNotFoundException(model, ex);
        if (ex is OllamaException || ex is HttpRequestException { StatusCode: not null })
            return new LlmUnavailableException($"Ollama at {url} returned an error: {ex.Message}", ex);
        return new LlmUnavailableException(
            $"Cannot reach Ollama at {url}. Start Ollama (https://ollama.com) or check the Ollama URL in settings.", ex);
    }
}
