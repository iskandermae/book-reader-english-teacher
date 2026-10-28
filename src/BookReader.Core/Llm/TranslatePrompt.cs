namespace BookReader.Core.Llm;

/// <summary>Default template of the "Translate selection" tool (setting <c>prompt.translate</c>).</summary>
public static class TranslatePrompt
{
    /// <summary>
    /// Translates only the selection into the native language and answers with two lines only: "Native:" and "Literal:".
    /// The sentence is deliberately not in the default: small local models tend to translate it too,
    /// which would break the "selection only" rule. Users may add {sentence} or {paragraph} in their own template.
    /// </summary>
    public const string DefaultTemplate =
        """
        Translate the text between the <text> tags into {target_language}.
        Translate only that text. No preface, no quotes, no notes, no explanations. Reply in exactly two lines:
        Native: [translation, as native speakers would say]
        Literal: [translation, Перекладай максимально близько до оригіналу, але зберігай зміст, не перекладай дослівно окремі слова. Для ідіом і фразових конструкцій показуй буквальний зміст у примітках у дужках. Мета перекладу - допомогти зрозуміти англійське формулювання, як вони думають.]

        <text>
        {selection}
        </text>
        """;
}
