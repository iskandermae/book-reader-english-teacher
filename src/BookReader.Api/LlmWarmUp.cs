using BookReader.Core.Llm;

namespace BookReader.Api;

/// <summary>
/// Starts a model warm-up in the background (fire and forget). The provider is scoped (it reads settings from the database),
/// so the background work needs its own scope instead of the request's.
/// </summary>
public class LlmWarmUp(IServiceScopeFactory scopes, ILogger<LlmWarmUp> logger)
{
    // Virtual so controller tests can replace it without a real provider.
    public virtual void Start() => _ = Task.Run(async () =>
    {
        // The provider's WarmUpAsync never throws; the try/catch covers scope creation and service resolving,
        // so the task cannot fault unobserved.
        try
        {
            using var scope = scopes.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ILlmProvider>().WarmUpAsync();
        }
        catch (Exception ex)
        {
            logger.LogWarning("Ollama warm-up could not start ({Reason})", ex.GetType().Name);
        }
    });
}
