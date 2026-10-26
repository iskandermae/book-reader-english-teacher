using System.Runtime.CompilerServices;
using BookReader.Core.Llm;

namespace BookReader.Tests;

/// <summary>Scripted <see cref="ILlmProvider"/> for tests: deterministic, no network.</summary>
public sealed class FakeLlmProvider : ILlmProvider
{
    public LlmStatus Status { get; set; } = new(true, "http://fake", "fake-model", null);
    public IReadOnlyList<string> Models { get; set; } = [];
    public IReadOnlyList<string> Chunks { get; set; } = [];

    /// <summary>Thrown before anything is produced (like a refused connection).</summary>
    public Exception? Failure { get; set; }

    /// <summary>Thrown after all <see cref="Chunks"/> (like a connection lost mid-answer).</summary>
    public Exception? FailAfterChunks { get; set; }

    public string? LastPrompt { get; private set; }

    public Task<LlmStatus> GetStatusAsync(CancellationToken ct = default) => Task.FromResult(Status);

    public Task<IReadOnlyList<string>> ListModelsAsync(CancellationToken ct = default) =>
        Failure is null ? Task.FromResult(Models) : Task.FromException<IReadOnlyList<string>>(Failure);

    public async IAsyncEnumerable<string> GenerateAsync(string prompt, [EnumeratorCancellation] CancellationToken ct = default)
    {
        LastPrompt = prompt;
        if (Failure is not null)
            throw Failure;
        foreach (var chunk in Chunks)
            yield return chunk;
        await Task.CompletedTask;
        if (FailAfterChunks is not null)
            throw FailAfterChunks;
    }
}
