namespace BookReader.Core.Llm;

/// <summary>Builds the prompt of the "Explain selection" tool.</summary>
public static class ExplainPrompt
{
    /// <summary>
    /// Prompt that explains only <paramref name="text"/> in simple English (not the native language) and answers with three lines:
    /// "Meaning:", "Grammar:" and "Usage:". The optional <paramref name="context"/> is given only to pick the meaning in this sentence.
    /// </summary>
    public static string Build(string text, string? context)
    {
        var contextBlock = string.IsNullOrWhiteSpace(context)
            ? ""
            : $"""

              The text comes from this sentence. Use it only to choose the right meaning; do not explain the sentence itself:
              <context>
              {context.Trim()}
              </context>

              """;

        return $"""
            Explain the text between the <text> tags to a learner of English. Use simple English.
            Explain only that text. No preface, no quotes, no extra notes. Reply in exactly three lines:
            Meaning: [what it means here, in simple words]
            Grammar: [the grammar or structure of the text, briefly]
            Usage: [how and when people use it, briefly]
            {contextBlock}
            <text>
            {text.Trim()}
            </text>
            """;
    }
}
