using System.Text.RegularExpressions;

namespace BookReader.Core.Llm;

/// <summary>Values that fill the placeholders of a prompt template.</summary>
/// <param name="Selection">The selected text. Required.</param>
/// <param name="Sentence">The sentence around the selection; null or blank gives an empty string.</param>
/// <param name="Paragraph">The paragraph around the selection; null or blank gives an empty string.</param>
/// <param name="NativeLanguage">Value of <c>{native_language}</c> and (for now) <c>{target_language}</c>.</param>
/// <param name="FromLanguage">Value of <c>{from_language}</c>.</param>
public record PromptValues(string Selection, string? Sentence, string? Paragraph, string NativeLanguage, string FromLanguage);

/// <summary>Placeholder handling shared by all prompt templates (built-in and, later, custom actions).</summary>
public static partial class PromptTemplate
{
    public const string SelectionPlaceholder = "selection";

    /// <summary>Placeholder names without braces.</summary>
    public static readonly IReadOnlyList<string> Placeholders =
        [SelectionPlaceholder, "sentence", "paragraph", "native_language", "target_language", "from_language"];

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
        };
        return PlaceholderRegex().Replace(template, m => map.GetValueOrDefault(m.Groups[1].Value, m.Value));
    }

    /// <summary>Returns an error text per problem (unknown placeholder, missing {selection}); empty when the template is valid.</summary>
    public static IReadOnlyList<string> Validate(string template)
    {
        var used = PlaceholderRegex().Matches(template).Select(m => m.Groups[1].Value).ToList();
        var errors = used.Distinct().Where(name => !Placeholders.Contains(name))
            .Select(name => $"Unknown placeholder '{{{name}}}'. Known placeholders: {string.Join(", ", Placeholders.Select(p => $"{{{p}}}"))}.")
            .ToList();
        if (!used.Contains(SelectionPlaceholder))
            errors.Add($"The template must contain {{{SelectionPlaceholder}}}.");
        return errors;
    }
}
