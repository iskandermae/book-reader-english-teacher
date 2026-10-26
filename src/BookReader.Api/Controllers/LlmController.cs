using System.Text.Json;
using BookReader.Api.Filters;
using BookReader.Core.Llm;
using BookReader.Core.Settings;
using Microsoft.AspNetCore.Mvc;

namespace BookReader.Api.Controllers;

[ApiController]
[Route("api/llm")]
[ServiceFilter<LlmExceptionFilter>]
public class LlmController(ILlmProvider llm, ISettingsService settings) : ControllerBase
{
    /// <summary>Checks whether the LLM server (Ollama) is reachable. Always returns 200; a problem is reported in the error field.</summary>
    [HttpGet("status")]
    [ProducesResponseType<LlmStatus>(StatusCodes.Status200OK)]
    public async Task<LlmStatus> GetStatus(CancellationToken ct) => await llm.GetStatusAsync(ct);

    /// <summary>Lists the names of the installed models.</summary>
    /// <response code="503">Ollama is not reachable; the detail field says how to fix it.</response>
    [HttpGet("models")]
    [ProducesResponseType<string[]>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IReadOnlyList<string>> GetModels(CancellationToken ct) => await llm.ListModelsAsync(ct);

    /// <summary>
    /// Sends a prompt to the chosen model and streams the answer as Server-Sent Events.
    /// Each chunk is an event with a JSON string as data (for example <c>data: "Hello"</c>); the stream ends with <c>event: done</c>.
    /// If the model fails after the stream started, an <c>event: error</c> with the message as data is sent instead.
    /// </summary>
    /// <response code="400">Blank prompt, no model chosen in settings, or the chosen model is not installed.</response>
    /// <response code="503">Ollama is not reachable; the detail field says how to fix it.</response>
    [HttpPost("test")]
    [ProducesResponseType<string>(StatusCodes.Status200OK, "text/event-stream")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<IActionResult> Test([FromBody] LlmTestRequest request, CancellationToken ct)
    {
        // [ApiController] only rejects null; a blank prompt is rejected here.
        if (string.IsNullOrWhiteSpace(request.Prompt))
            return BadRequest(new ProblemDetails { Title = "Invalid prompt", Detail = "Prompt must not be empty." });

        return await StreamAsync(request.Prompt, ct);
    }

    /// <summary>
    /// Translates the selected text into the native language (setting <c>language.native</c>, Ukrainian by default) and streams the translation.
    /// The stream format is the same as in the test endpoint. Only <c>text</c> is translated; <c>context</c> is not used yet (kept for custom prompts).
    /// </summary>
    /// <response code="400">Blank text, no model chosen in settings, or the chosen model is not installed.</response>
    /// <response code="503">Ollama is not reachable; the detail field says how to fix it.</response>
    [HttpPost("translate")]
    [ProducesResponseType<string>(StatusCodes.Status200OK, "text/event-stream")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable, "application/problem+json")]
    public async Task<IActionResult> Translate([FromBody] TranslateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest(new ProblemDetails { Title = "Invalid text", Detail = "Text must not be empty." });

        var language = (await settings.GetAllAsync(ct))[SettingsService.LanguageNative];
        if (string.IsNullOrWhiteSpace(language))
            throw new LlmNotConfiguredException("Set your native language in settings.");

        return await StreamAsync(TranslatePrompt.Build(request.Text, language.Trim()), ct);
    }

    private async Task<IActionResult> StreamAsync(string prompt, CancellationToken ct)
    {
        await using var chunks = llm.GenerateAsync(prompt, ct).GetAsyncEnumerator(ct);
        // The first MoveNext runs before the response starts, so setup errors still become a clean 400/503 (see LlmExceptionFilter).
        var hasNext = await chunks.MoveNextAsync();

        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        try
        {
            while (hasNext)
            {
                await WriteEventAsync(null, JsonSerializer.Serialize(chunks.Current), ct);
                hasNext = await chunks.MoveNextAsync();
            }
            await WriteEventAsync("done", "", ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Headers are already sent, so the error travels inside the stream. Unexpected errors get a generic text.
            var message = ex is LlmException ? ex.Message : "The AI request failed unexpectedly.";
            await WriteEventAsync("error", JsonSerializer.Serialize(message), ct);
        }
        return new EmptyResult();
    }

    private async Task WriteEventAsync(string? name, string data, CancellationToken ct)
    {
        var text = (name is null ? "" : $"event: {name}\n") + $"data: {data}\n\n";
        await Response.WriteAsync(text, ct);
        await Response.Body.FlushAsync(ct);
    }
}

/// <summary>Request of the LLM test endpoint.</summary>
/// <param name="Prompt">The text sent to the model.</param>
public record LlmTestRequest(string Prompt);

/// <summary>Request of the translate endpoint.</summary>
/// <param name="Text">The selected text to translate. Required.</param>
/// <param name="Context">The sentence(s) around the selection. Accepted but not used by the translate prompt yet.</param>
public record TranslateRequest(string Text, string? Context = null);
