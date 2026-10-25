using System.Text;
using System.Text.RegularExpressions;

namespace BookReader.Core.Books;

/// <summary>A chapter as found in the text, before it is stored.</summary>
public record ParsedChapter(string Title, IReadOnlyList<string> Paragraphs);

/// <summary>Pure text processing for book import (no database), so it is easy to unit test.</summary>
public static class BookParser
{
    // A heading is a whole line like "Chapter 1: A Day of Very Low Probability" (HPMOR style).
    public const string DefaultChapterRegex = @"^\s*Chapter\s+\d+\b.*$";

    // Protects the import from catastrophic backtracking in a user-supplied pattern.
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(2);

    // Throws on invalid bytes instead of silently replacing them with U+FFFD; that is how non-UTF-8 files are detected.
    private static readonly UTF8Encoding StrictUtf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    /// <summary>Decodes UTF-8 (with or without BOM) bytes. Anything else is rejected with a clear message.</summary>
    public static string Decode(byte[] bytes)
    {
        try
        {
            // GetString keeps the BOM as U+FEFF, so strip it.
            return StrictUtf8.GetString(bytes).TrimStart('﻿');
        }
        catch (DecoderFallbackException)
        {
            throw new BookImportException("The file is not valid UTF-8 text. Save it as UTF-8 (with or without BOM) and try again.");
        }
    }

    public static Regex CreateChapterRegex(string pattern)
    {
        try
        {
            return new Regex(pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, RegexTimeout);
        }
        catch (ArgumentException ex)
        {
            throw new BookImportException($"The chapter heading pattern is not a valid regular expression: {ex.Message}");
        }
    }

    /// <summary>
    /// Splits text into chapters at lines matching <paramref name="chapterHeading"/>.
    /// Text before the first heading is put at the start of the first chapter; no headings gives one chapter named <paramref name="fallbackTitle"/>.
    /// </summary>
    public static IReadOnlyList<ParsedChapter> Parse(string text, Regex chapterHeading, string fallbackTitle)
    {
        var lines = text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');

        var chapters = new List<ParsedChapter>();
        var preface = new List<string>(); // lines before the first heading
        var current = preface;
        string? currentTitle = null;

        void CloseChapter()
        {
            if (currentTitle is not null)
                chapters.Add(new ParsedChapter(currentTitle, ToParagraphs(current)));
        }

        try
        {
            foreach (var line in lines)
            {
                if (chapterHeading.IsMatch(line))
                {
                    CloseChapter();
                    // The first heading keeps the preface lines collected so far; later ones start empty.
                    if (currentTitle is not null)
                        current = [];
                    currentTitle = line.Trim();
                }
                else
                {
                    current.Add(line);
                }
            }
        }
        catch (RegexMatchTimeoutException)
        {
            throw new BookImportException("The chapter heading pattern is too slow to evaluate. Use a simpler regular expression.");
        }
        CloseChapter();

        return chapters.Count > 0 ? chapters : [new ParsedChapter(fallbackTitle, ToParagraphs(preface))];
    }

    // Paragraphs are separated by blank lines; whitespace is trimmed and empty ones are dropped.
    private static List<string> ToParagraphs(List<string> lines)
    {
        var paragraphs = new List<string>();
        var buffer = new List<string>();

        void Flush()
        {
            var paragraph = string.Join('\n', buffer).Trim();
            if (paragraph.Length > 0)
                paragraphs.Add(paragraph);
            buffer.Clear();
        }

        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line))
                Flush();
            else
                buffer.Add(line.Trim());
        }
        Flush();
        return paragraphs;
    }
}
