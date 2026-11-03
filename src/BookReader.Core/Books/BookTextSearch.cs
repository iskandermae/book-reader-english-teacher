using System.Text.RegularExpressions;

namespace BookReader.Core.Books;

/// <summary>Pure text matching for book search: word-based, case/punctuation-insensitive phrase match inside one text.</summary>
public static partial class BookTextSearch
{
    /// <summary>Characters kept on each side of a match in a snippet (before cutting at word edges).</summary>
    public const int SnippetContext = 100;

    // A word is letters/digits; an apostrophe between two letters stays inside the word ("don't").
    [GeneratedRegex(@"[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*")]
    private static partial Regex WordPattern();

    private readonly record struct Word(string Key, int Start, int End);

    /// <summary>The normalized words of a query: lower case, apostrophes dropped, punctuation and spacing ignored.</summary>
    public static List<string> NormalizeWords(string text) => Words(text).Select(w => w.Key).ToList();

    /// <summary>
    /// Finds the first place where all query words appear in order, next to each other, as whole words.
    /// Returns a snippet of the original text around it, or null when there is no match.
    /// </summary>
    public static string? FindSnippet(string text, IReadOnlyList<string> queryWords)
    {
        if (queryWords.Count == 0)
            return null;

        var words = Words(text);
        for (var i = 0; i + queryWords.Count <= words.Count; i++)
        {
            var matches = true;
            for (var j = 0; j < queryWords.Count && matches; j++)
                matches = words[i + j].Key == queryWords[j];
            if (matches)
                return Snippet(text, words[i].Start, words[i + queryWords.Count - 1].End);
        }
        return null;
    }

    private static List<Word> Words(string text) =>
        WordPattern().Matches(text)
            .Select(m => new Word(m.Value.ToLowerInvariant().Replace("'", "").Replace("’", ""), m.Index, m.Index + m.Length))
            .ToList();

    private static string Snippet(string text, int matchStart, int matchEnd)
    {
        var start = Math.Max(0, matchStart - SnippetContext);
        // Cut at a word edge: move the start forward / the end back to the nearest space, never into the match.
        while (start > 0 && start < matchStart && !char.IsWhiteSpace(text[start - 1]))
            start++;
        var end = Math.Min(text.Length, matchEnd + SnippetContext);
        while (end < text.Length && end > matchEnd && !char.IsWhiteSpace(text[end]))
            end--;
        return text[start..end].Trim();
    }
}
