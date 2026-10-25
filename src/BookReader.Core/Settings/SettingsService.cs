using BookReader.Core.Data;
using Microsoft.EntityFrameworkCore;

namespace BookReader.Core.Settings;

public interface ISettingsService
{
    /// <summary>All known settings; keys never saved yet have their default value.</summary>
    Task<IReadOnlyDictionary<string, string>> GetAllAsync(CancellationToken ct = default);

    /// <summary>Validates and saves the given values (all or nothing), then returns all settings.</summary>
    /// <exception cref="SettingsValidationException">Unknown key, null value or value that is too long.</exception>
    Task<IReadOnlyDictionary<string, string>> UpdateAsync(IReadOnlyDictionary<string, string?> values, CancellationToken ct = default);
}

public class SettingsService(AppDbContext db) : ISettingsService
{
    public const string OllamaModel = "ollama.model";
    public const string UiSample = "ui.sample";
    public const int MaxValueLength = 1000;

    // Known keys with their defaults. Adding a setting = adding a line here (no migration needed).
    // The Ollama model is deliberately empty: the model name is never hardcoded (decision D12).
    private static readonly IReadOnlyDictionary<string, string> Defaults = new Dictionary<string, string>
    {
        [OllamaModel] = "",
        [UiSample] = "",
    };

    public async Task<IReadOnlyDictionary<string, string>> GetAllAsync(CancellationToken ct = default)
    {
        var stored = await db.Settings.AsNoTracking().ToDictionaryAsync(s => s.Key, s => s.Value, ct);
        // Defaults first, so removing a known key later never leaks stale rows into the API.
        return Defaults.ToDictionary(d => d.Key, d => stored.GetValueOrDefault(d.Key, d.Value));
    }

    public async Task<IReadOnlyDictionary<string, string>> UpdateAsync(
        IReadOnlyDictionary<string, string?> values, CancellationToken ct = default)
    {
        Validate(values);

        try
        {
            await SaveAsync(values, ct);
        }
        catch (DbUpdateException)
        {
            // Two first-time saves of the same key can race: the loser hits the primary key.
            // Retry once from a clean state; the row now exists, so it is updated instead of inserted.
            db.ChangeTracker.Clear();
            await SaveAsync(values, ct);
        }

        return await GetAllAsync(ct);
    }

    private async Task SaveAsync(IReadOnlyDictionary<string, string?> values, CancellationToken ct)
    {
        var keys = values.Keys.ToList();
        var existing = await db.Settings.Where(s => keys.Contains(s.Key)).ToDictionaryAsync(s => s.Key, ct);
        foreach (var (key, value) in values)
        {
            if (existing.TryGetValue(key, out var row))
                row.Value = value!;
            else
                db.Settings.Add(new Setting { Key = key, Value = value! });
        }
        await db.SaveChangesAsync(ct);
    }

    // Collects every problem so the user can fix them in one go; nothing is saved if any exists.
    private static void Validate(IReadOnlyDictionary<string, string?> values)
    {
        var errors = new List<string>();
        foreach (var (key, value) in values)
        {
            if (!Defaults.ContainsKey(key))
                errors.Add($"Unknown setting '{key}'. Known settings: {string.Join(", ", Defaults.Keys)}.");
            else if (value is null)
                errors.Add($"Setting '{key}' must not be null.");
            else if (value.Length > MaxValueLength)
                errors.Add($"Setting '{key}' is too long ({value.Length} characters, maximum is {MaxValueLength}).");
        }
        if (errors.Count > 0)
            throw new SettingsValidationException(string.Join(" ", errors));
    }
}
