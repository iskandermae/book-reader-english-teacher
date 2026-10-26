namespace BookReader.Core.Llm;

/// <summary>Result of an availability check. <see cref="Error"/> is set only when not available.</summary>
public record LlmStatus(bool Available, string Url, string Model, string? Error);

/// <summary>The LLM backend (decision D5). Ollama first; optional cloud providers can implement it later.</summary>
public interface ILlmProvider
{
    /// <summary>Checks whether the LLM server answers. Never throws: problems are reported in <see cref="LlmStatus.Error"/>.</summary>
    Task<LlmStatus> GetStatusAsync(CancellationToken ct = default);

    /// <summary>Names of the installed models.</summary>
    /// <exception cref="LlmUnavailableException">The LLM server cannot be reached.</exception>
    Task<IReadOnlyList<string>> ListModelsAsync(CancellationToken ct = default);

    /// <summary>Streams the generated text in chunks. Errors are thrown on the first MoveNext, before any text is produced.</summary>
    /// <exception cref="LlmNotConfiguredException">No model is chosen in settings.</exception>
    /// <exception cref="LlmModelNotFoundException">The chosen model is not installed.</exception>
    /// <exception cref="LlmUnavailableException">The LLM server cannot be reached.</exception>
    IAsyncEnumerable<string> GenerateAsync(string prompt, CancellationToken ct = default);
}

/// <summary>Base of all expected LLM problems. The message is safe to show to the user and says what to do.</summary>
public abstract class LlmException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>The LLM server is not reachable or failed. Maps to 503.</summary>
public class LlmUnavailableException(string message, Exception? inner = null) : LlmException(message, inner);

/// <summary>The LLM is not set up yet (for example no model chosen). Maps to 400.</summary>
public class LlmNotConfiguredException(string message) : LlmException(message);

/// <summary>The chosen model is not installed. Maps to 400.</summary>
public class LlmModelNotFoundException(string model, Exception? inner = null)
    : LlmException($"Model '{model}' is not installed. Run `ollama pull {model}` or choose another model in settings.", inner);
