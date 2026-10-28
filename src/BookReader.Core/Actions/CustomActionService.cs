using BookReader.Core.Data;
using BookReader.Core.Llm;
using BookReader.Core.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BookReader.Core.Actions;

/// <summary>An action as returned by the API.</summary>
/// <param name="Id">Assigned by the server.</param>
/// <param name="Name">Button text; unique (ignoring case).</param>
/// <param name="Prompt">Prompt template; see the placeholders of the prompt settings.</param>
public record CustomActionDto(int Id, string Name, string Prompt);

/// <summary>An action in a replace-all request.</summary>
/// <param name="Name">Button text, 1-40 characters after trimming; unique (ignoring case).</param>
/// <param name="Prompt">Prompt template, at most 4000 characters; must contain {selection}; same placeholders as the prompt settings.</param>
/// <param name="Id">Id of an existing action to keep (and update); omit for a new action.</param>
public record CustomActionInput(string Name, string Prompt, int? Id = null);

/// <summary>Thrown when the action list is invalid. The message is safe to show to the user.</summary>
public class ActionsValidationException(string message) : Exception(message);

public interface ICustomActionService
{
    /// <summary>All actions in saved order.</summary>
    Task<IReadOnlyList<CustomActionDto>> ListAsync(CancellationToken ct = default);

    /// <summary>One action, or null when the id is unknown.</summary>
    Task<CustomActionDto?> GetAsync(int id, CancellationToken ct = default);

    /// <summary>Replaces the whole list in one transaction (all or nothing) and returns it with the assigned ids.</summary>
    /// <exception cref="ActionsValidationException">Too many actions, bad name, duplicate name or id, or an invalid prompt.</exception>
    Task<IReadOnlyList<CustomActionDto>> ReplaceAsync(IReadOnlyList<CustomActionInput> actions, CancellationToken ct = default);
}

public class CustomActionService(AppDbContext db, ILogger<CustomActionService> logger) : ICustomActionService
{
    public const int MaxActions = 20;
    public const int MaxNameLength = 40;

    public async Task<IReadOnlyList<CustomActionDto>> ListAsync(CancellationToken ct = default) =>
        await db.CustomActions.AsNoTracking().OrderBy(a => a.Position)
            .Select(a => new CustomActionDto(a.Id, a.Name, a.Prompt)).ToListAsync(ct);

    public async Task<CustomActionDto?> GetAsync(int id, CancellationToken ct = default) =>
        await db.CustomActions.AsNoTracking().Where(a => a.Id == id)
            .Select(a => new CustomActionDto(a.Id, a.Name, a.Prompt)).FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<CustomActionDto>> ReplaceAsync(IReadOnlyList<CustomActionInput> actions, CancellationToken ct = default)
    {
        Validate(actions);

        // One SaveChanges is one transaction: a failure leaves the old list untouched.
        var existing = await db.CustomActions.ToDictionaryAsync(a => a.Id, ct);
        var kept = new HashSet<int>();
        for (var position = 0; position < actions.Count; position++)
        {
            var input = actions[position];
            // An id that no longer exists (deleted meanwhile) simply becomes a new action.
            if (input.Id is { } id && existing.TryGetValue(id, out var row))
            {
                kept.Add(id);
                row.Name = input.Name.Trim();
                row.Prompt = input.Prompt;
                row.Position = position;
            }
            else
            {
                db.CustomActions.Add(new CustomAction { Name = input.Name.Trim(), Prompt = input.Prompt, Position = position });
            }
        }
        db.CustomActions.RemoveRange(existing.Values.Where(a => !kept.Contains(a.Id)));
        await db.SaveChangesAsync(ct);

        var result = await ListAsync(ct);
        logger.LogInformation("Custom actions saved: {Count}", result.Count);
        return result;
    }

    // Collects every problem so the user can fix them in one go; nothing is saved if any exists.
    private static void Validate(IReadOnlyList<CustomActionInput> actions)
    {
        var errors = new List<string>();
        if (actions.Count > MaxActions)
            errors.Add($"Too many actions ({actions.Count}, maximum is {MaxActions}).");

        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var ids = new HashSet<int>();
        foreach (var (action, index) in actions.Select((a, i) => (a, i)))
        {
            var label = $"Action {index + 1}";
            var name = action.Name?.Trim() ?? "";
            if (name.Length is 0 or > MaxNameLength)
                errors.Add($"{label}: the name must be 1-{MaxNameLength} characters.");
            else if (!names.Add(name))
                errors.Add($"{label}: the name '{name}' is used twice.");

            if (action.Id is { } id && !ids.Add(id))
                errors.Add($"{label}: the id {id} is used twice.");

            var prompt = action.Prompt ?? "";
            if (prompt.Length > SettingsService.MaxPromptLength)
                errors.Add($"{label}: the prompt is too long ({prompt.Length} characters, maximum is {SettingsService.MaxPromptLength}).");
            errors.AddRange(PromptTemplate.Validate(prompt).Select(e => $"{label}: {e}"));
        }
        if (errors.Count > 0)
            throw new ActionsValidationException(string.Join(" ", errors));
    }
}
