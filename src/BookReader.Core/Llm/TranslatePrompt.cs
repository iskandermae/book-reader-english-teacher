namespace BookReader.Core.Llm;

/// <summary>Builds the prompt of the "Translate selection" tool.</summary>
public static class TranslatePrompt
{
    /// <summary>
    /// Prompt that translates only <paramref name="text"/> into <paramref name="targetLanguage"/> and answers with the translation alone.
    /// The surrounding sentence is deliberately not part of the prompt: small local models tend to translate it too,
    /// which would break the "selection only" rule. Context placeholders for custom prompts come with S2.6.
    /// </summary>
    public static string Build(string text, string targetLanguage) =>
        $"""
        Translate the text between the <text> tags into {targetLanguage}.
        Translate only that text. Reply with the translation only: no preface, no quotes, no notes, no explanations.
        Format of the output:
        Native: [translation, as native speakers would say]
        Literal: [translation, word-for-word, how the original text is understood]

        <text>
        {text.Trim()}
        </text>
        """;
}
