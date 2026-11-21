namespace BookReader.Core.Llm;

/// <summary>One recorded LLM call. Holds the full texts, so it lives in memory only and is never logged or saved.</summary>
/// <param name="Time">When the call started (UTC).</param>
/// <param name="Action">What triggered the call: test, translate, explain, or the custom action name.</param>
/// <param name="Model">The model chosen in settings when the call was made (empty if none).</param>
/// <param name="Prompt">The full text sent to the model.</param>
/// <param name="Answer">The full text received (the part received so far if the call failed).</param>
/// <param name="DurationMs">How long the call took, in milliseconds.</param>
/// <param name="Error">Error text if the call failed, otherwise null.</param>
public record LlmCallEntry(DateTimeOffset Time, string Action, string Model, string Prompt, string Answer, long DurationMs, string? Error);

/// <summary>Keeps the last <see cref="Capacity"/> LLM calls in memory, newest first (story S2.9). Thread-safe.</summary>
public class LlmCallLog
{
    public const int Capacity = 10;

    private readonly LinkedList<LlmCallEntry> _entries = new();

    public void Add(LlmCallEntry entry)
    {
        lock (_entries)
        {
            _entries.AddFirst(entry);
            if (_entries.Count > Capacity)
                _entries.RemoveLast();
        }
    }

    /// <summary>A snapshot, newest first.</summary>
    public IReadOnlyList<LlmCallEntry> GetAll()
    {
        lock (_entries)
            return _entries.ToList();
    }

    public void Clear()
    {
        lock (_entries)
            _entries.Clear();
    }
}
