using BookReader.Core.Books;
using BookReader.Core.Data;
using BookReader.Core.Llm;
using Microsoft.EntityFrameworkCore;

namespace BookReader.Core.Settings;

public interface ISettingsService
{
    /// <summary>All known settings; keys never saved yet have their default value.</summary>
    Task<IReadOnlyDictionary<string, string>> GetAllAsync(CancellationToken ct = default);

    /// <summary>One known setting (the saved value, or its default). Reads a single row instead of all settings.</summary>
    /// <exception cref="KeyNotFoundException">The key is not a known setting.</exception>
    Task<string> GetAsync(string key, CancellationToken ct = default);

    /// <summary>Validates and saves the given values (all or nothing), then returns all settings.</summary>
    /// <exception cref="SettingsValidationException">Unknown key, null value or value that is too long, or a prompt template with an unknown placeholder or without {selection}, or a value outside the allowed set of a reader setting.</exception>
    Task<IReadOnlyDictionary<string, string>> UpdateAsync(IReadOnlyDictionary<string, string?> values, CancellationToken ct = default);
}

public class SettingsService(AppDbContext db) : ISettingsService
{
    public const string OllamaModel = "ollama.model";
    public const string OllamaUrl = "ollama.url";
    public const string LanguageNative = "language.native";
    public const string LanguageFrom = "language.from";
    public const string PromptTranslate = "prompt.translate";
    public const string PromptExplain = "prompt.explain";
    public const string UiSample = "ui.sample";
    public const string ChapterRegex = "import.chapterRegex";
    public const string ReaderFontSize = "reader.fontSize";
    public const string ReaderTheme = "reader.theme";
    public const string ReaderWidth = "reader.width";
    public const string ReaderPanelWidth = "reader.panelWidth"; // result panel width, percent of the page
    public const int MaxValueLength = 1000;
    public const int MaxPromptLength = 4000; // prompt.* keys hold whole templates
    private const string PromptKeyPrefix = "prompt.";
    private const int MinPanelWidth = 20;
    private const int MaxPanelWidth = 70;

    // Known keys with their defaults. Adding a setting = adding a line here (no migration needed).
    // The Ollama model is deliberately empty: the model name is never hardcoded (decision D12).
    private static readonly IReadOnlyDictionary<string, string> Defaults = new Dictionary<string, string>
    {
        [OllamaModel] = "",
        [OllamaUrl] = "http://localhost:11434",
        [LanguageNative] = "Ukrainian",
        [LanguageFrom] = "English",
        [PromptTranslate] = TranslatePrompt.DefaultTemplate,
        [PromptExplain] = ExplainPrompt.DefaultTemplate,
        [UiSample] = "",
        [ChapterRegex] = BookParser.DefaultChapterRegex,
        [ReaderFontSize] = "medium",
        [ReaderTheme] = "light",
        [ReaderWidth] = "medium",
        [ReaderPanelWidth] = "40",
    };

    // Keys that accept only a fixed set of values (an empty string is not allowed for them).
    private static readonly IReadOnlyDictionary<string, string[]> AllowedValues = new Dictionary<string, string[]>
    {
        [ReaderFontSize] = ["small", "medium", "large", "xlarge"],
        [ReaderTheme] = ["light", "dark"],
        [ReaderWidth] = ["narrow", "medium", "wide"],
    };

    /// <summary>Default value of every known setting, ignoring anything saved (for "Reset to default"). Static: needs no database.</summary>
    public static IReadOnlyDictionary<string, string> GetDefaults() => Defaults;

    public async Task<IReadOnlyDictionary<string, string>> GetAllAsync(CancellationToken ct = default)
    {
        var stored = await db.Settings.AsNoTracking().ToDictionaryAsync(s => s.Key, s => s.Value, ct);
        // Defaults first, so removing a known key later never leaks stale rows into the API.
        return Defaults.ToDictionary(d => d.Key, d => stored.GetValueOrDefault(d.Key, d.Value));
    }

    public async Task<string> GetAsync(string key, CancellationToken ct = default)
    {
        var fallback = Defaults[key];
        var stored = await db.Settings.AsNoTracking().Where(s => s.Key == key).Select(s => s.Value).FirstOrDefaultAsync(ct);
        return stored ?? fallback;
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
            else if (value.Length > MaxLength(key))
                errors.Add($"Setting '{key}' is too long ({value.Length} characters, maximum is {MaxLength(key)}).");
            else if (AllowedValues.TryGetValue(key, out var allowed) && !allowed.Contains(value))
                errors.Add($"Setting '{key}' must be one of: {string.Join(", ", allowed)}.");
            else if (key == ReaderPanelWidth && !IsValidPanelWidth(value))
                errors.Add($"Setting '{ReaderPanelWidth}' must be a whole number from {MinPanelWidth} to {MaxPanelWidth}.");
            else if (key.StartsWith(PromptKeyPrefix))
                errors.AddRange(PromptTemplate.Validate(value).Select(e => $"Setting '{key}': {e}"));
            else if (key == ChapterRegex)
                ValidateChapterRegex(value, errors);
            else if (key == OllamaUrl && !IsHttpUrl(value))
                errors.Add($"Setting '{OllamaUrl}' must be an http or https address, for example http://localhost:11434.");
        }
        if (errors.Count > 0)
            throw new SettingsValidationException(string.Join(" ", errors));
    }

    private static int MaxLength(string key) => key.StartsWith(PromptKeyPrefix) ? MaxPromptLength : MaxValueLength;

    // Invariant culture and digits only: no signs, spaces or decimals, so each value has one spelling.
    private static bool IsValidPanelWidth(string value) =>
        value.All(char.IsAsciiDigit)
        && int.TryParse(value, out var percent) && percent is >= MinPanelWidth and <= MaxPanelWidth;

    private static bool IsHttpUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https";

    // Reject a broken pattern when it is saved, so the user sees the problem in settings and not only at the next import.
    private static void ValidateChapterRegex(string pattern, List<string> errors)
    {
        try
        {
            BookParser.CreateChapterRegex(pattern);
        }
        catch (BookImportException ex)
        {
            errors.Add($"Setting '{ChapterRegex}': {ex.Message}");
        }
    }
}
