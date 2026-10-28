using System.Text.RegularExpressions;

namespace BookReader.Core.Llm;

/// <summary>Values that fill the placeholders of a prompt template.</summary>
/// <param name="Selection">The selected text. Required.</param>
/// <param name="Sentence">The sentence around the selection; null or blank gives an empty string.</param>
/// <param name="Paragraph">The paragraph around the selection; null or blank gives an empty string.</param>
/// <param name="NativeLanguage">Value of <c>{native_language}</c> and (for now) <c>{target_language}</c>.</param>
/// <param name="FromLanguage">Value of <c>{from_language}</c>.</param>
/// <param name="EnglishLevel">Value of <c>{english_level}</c> (CEFR level A1-C2).</param>
public record PromptValues(string Selection, string? Sentence, string? Paragraph, string NativeLanguage, string FromLanguage, string EnglishLevel);

/// <summary>A placeholder a prompt template may use.</summary>
/// <param name="Name">Name without braces.</param>
/// <param name="Description">What the placeholder is replaced with (shown in the settings UI).</param>
public record PlaceholderInfo(string Name, string Description);

/// <summary>Placeholder handling shared by all prompt templates (built-in and, later, custom actions).</summary>
public static partial class PromptTemplate
{
    public const string SelectionPlaceholder = "selection";

    /// <summary>The single source of truth for placeholders: used by validation and by the UI (via the API).</summary>
    public static readonly IReadOnlyList<PlaceholderInfo> Placeholders =
    [
        new(SelectionPlaceholder, "The selected text (required)."),
        new("sentence", "The sentence around the selection; empty if unknown."),
        new("paragraph", "The paragraph around the selection; empty if unknown."),
        new("native_language", "Your native language (setting language.native)."),
        new("target_language", "The language to translate into (same as the native language for now)."),
        new("from_language", "The language of the book (setting language.from)."),
        new("english_level", "Your English level, A1-C2 (setting language.level)."),
    ];

    // Any {word}; text with other braces (JSON examples, "{ }") is not a placeholder.
    [GeneratedRegex(@"\{(\w+)\}")]
    private static partial Regex PlaceholderRegex();

    /// <summary>
    /// Replaces the placeholders in one pass: inserted text is never scanned again, so a selection that contains
    /// "{sentence}" stays as typed. Unknown placeholders are left untouched (they are rejected when the template is saved).
    /// </summary>
    public static string Fill(string template, PromptValues values)
    {
        var map = new Dictionary<string, string>
        {
            [SelectionPlaceholder] = values.Selection.Trim(),
            ["sentence"] = values.Sentence?.Trim() ?? "",
            ["paragraph"] = values.Paragraph?.Trim() ?? "",
            ["native_language"] = values.NativeLanguage.Trim(),
            ["target_language"] = values.NativeLanguage.Trim(),
            ["from_language"] = values.FromLanguage.Trim(),
            ["english_level"] = values.EnglishLevel.Trim(),
        };
        return PlaceholderRegex().Replace(template, m => map.GetValueOrDefault(m.Groups[1].Value, m.Value));
    }

    /// <summary>Returns an error text per problem (unknown placeholder, missing {selection}); empty when the template is valid.</summary>
    public static IReadOnlyList<string> Validate(string template)
    {
        var used = PlaceholderRegex().Matches(template).Select(m => m.Groups[1].Value).ToList();
        var errors = used.Distinct().Where(name => Placeholders.All(p => p.Name != name))
            .Select(name => $"Unknown placeholder '{{{name}}}'. Known placeholders: {string.Join(", ", Placeholders.Select(p => $"{{{p.Name}}}"))}.")
            .ToList();
        if (!used.Contains(SelectionPlaceholder))
            errors.Add($"The template must contain {{{SelectionPlaceholder}}}.");
        return errors;
    }
}
