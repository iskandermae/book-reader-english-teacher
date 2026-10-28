namespace BookReader.Core.Actions;

/// <summary>A user-defined AI action: a named prompt template shown as a button next to Translate and Explain.</summary>
public class CustomAction
{
    /// <summary>Id of the action seeded on the first start (seeded by a migration).</summary>
    public const int SimplifyId = 1;

    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Prompt { get; set; }

    /// <summary>Order in the list (0-based); the list is saved as a whole, so it is always gapless.</summary>
    public int Position { get; set; }

    // Seeded once by a migration (not at every start), so deleting the action is final.
    public const string SimplifyName = "Simplify (B2)";
    public const string SimplifyPrompt =
        "Rewrite the text below in simple English at about B2 level. Keep the meaning. " +
        "Use the sentence only as context; do not rewrite it. Output only the rewritten text.\n\n" +
        "Text: {selection}\n" +
        "Context sentence (may be empty): {sentence}";
}
