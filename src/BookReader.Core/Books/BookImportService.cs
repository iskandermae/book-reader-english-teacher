using BookReader.Core.Data;
using BookReader.Core.Settings;

namespace BookReader.Core.Books;

/// <summary>Result of a successful import.</summary>
public record BookImportResult(int BookId, string Title, int ChapterCount);

/// <summary>One uploaded .txt file of a book.</summary>
public record BookImportFile(string FileName, Stream Content);

public interface IBookImportService
{
    /// <summary>
    /// Imports one book from 1..N .txt files. Files are merged in natural file-name order (not upload order);
    /// the title defaults to the first file's name without extension.
    /// </summary>
    /// <exception cref="BookImportException">No files, a file is not .txt, empty or not UTF-8 (the message names it), or invalid chapter regex setting.</exception>
    Task<BookImportResult> ImportAsync(IReadOnlyList<BookImportFile> files, string? title, CancellationToken ct = default);
}

public class BookImportService(AppDbContext db, ISettingsService settings) : IBookImportService
{
    public const int MaxTitleLength = 200;

    public async Task<BookImportResult> ImportAsync(IReadOnlyList<BookImportFile> files, string? title, CancellationToken ct = default)
    {
        if (files.Count == 0)
            throw new BookImportException("No files were uploaded. Choose at least one .txt file.");

        var sorted = files.OrderBy(f => f.FileName, NaturalFileNameComparer.Instance).ToList();

        var bookTitle = string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(sorted[0].FileName).Trim() : title.Trim();
        if (bookTitle.Length is 0 or > MaxTitleLength)
            throw new BookImportException($"The title must be between 1 and {MaxTitleLength} characters.");

        // Every file is validated before anything is stored, so one bad file rejects the whole import.
        var texts = new List<string>(sorted.Count);
        foreach (var file in sorted)
            texts.Add(await ReadTextAsync(file, ct));

        // A blank line between files keeps paragraphs apart; the chapter regex then runs on the merged text,
        // so a file without a heading continues the previous chapter.
        var text = string.Join("\n\n", texts);

        var pattern = (await settings.GetAllAsync(ct))[SettingsService.ChapterRegex];
        var chapters = BookParser.Parse(text, BookParser.CreateChapterRegex(pattern), bookTitle);

        var book = new Book
        {
            Title = bookTitle,
            ImportedAt = DateTime.UtcNow,
            Chapters = chapters.Select((c, i) => new Chapter
            {
                Index = i,
                Title = c.Title,
                Paragraphs = c.Paragraphs.Select((p, j) => new Paragraph { Index = j, Text = p }).ToList(),
            }).ToList(),
        };
        db.Books.Add(book);
        await db.SaveChangesAsync(ct); // one transaction: a book is never stored half-way

        return new BookImportResult(book.Id, book.Title, book.Chapters.Count);
    }

    private static async Task<string> ReadTextAsync(BookImportFile file, CancellationToken ct)
    {
        try
        {
            if (!string.Equals(Path.GetExtension(file.FileName), ".txt", StringComparison.OrdinalIgnoreCase))
                throw new BookImportException("Only .txt files can be imported.");

            using var buffer = new MemoryStream();
            await file.Content.CopyToAsync(buffer, ct);
            var text = BookParser.Decode(buffer.ToArray());
            return string.IsNullOrWhiteSpace(text) ? throw new BookImportException("The file is empty.") : text;
        }
        catch (BookImportException ex)
        {
            // Name the file so the user knows which one to fix.
            throw new BookImportException($"{file.FileName}: {ex.Message}");
        }
    }
}
