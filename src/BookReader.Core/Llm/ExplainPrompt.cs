namespace BookReader.Core.Llm;

/// <summary>Default template of the "Explain selection" tool (setting <c>prompt.explain</c>).</summary>
public static class ExplainPrompt
{
    /// <summary>
    /// Explains only the selection in simple English (not the native language) and answers with three lines:
    /// "Meaning:", "Grammar:" and "Usage:". The sentence line is always present and may be empty, because a
    /// template has no conditional blocks; it is given only to pick the meaning in this sentence.
    /// </summary>
    public const string DefaultTemplate =
        """
        Explain the text between the <text> tags to a learner of English. Use simple English.
        Explain only that text. No preface, no quotes, no extra notes. Reply in exactly three lines:
        Meaning: [what it means here, in simple words]
        Grammar: [the grammar or structure of the text, briefly]
        Usage: [how and when people use it, briefly]

        Context sentence (may be empty; use it only to choose the right meaning, do not explain the sentence itself): {sentence}

        <text>
        {selection}
        </text>
        """;
}
