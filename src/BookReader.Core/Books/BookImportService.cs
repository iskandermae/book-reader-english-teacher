using BookReader.Core.Data;
using BookReader.Core.Settings;

namespace BookReader.Core.Books;

/// <summary>Result of a successful import.</summary>
public record BookImportResult(int BookId, string Title, int ChapterCount);

public interface IBookImportService
{
    /// <summary>Imports one .txt book. The title defaults to the file name without extension.</summary>
    /// <exception cref="BookImportException">Not a .txt file, empty file, not UTF-8, or invalid chapter regex setting.</exception>
    Task<BookImportResult> ImportAsync(Stream content, string fileName, string? title, CancellationToken ct = default);
}

public class BookImportService(AppDbContext db, ISettingsService settings) : IBookImportService
{
    public const int MaxTitleLength = 200;

    public async Task<BookImportResult> ImportAsync(Stream content, string fileName, string? title, CancellationToken ct = default)
    {
        if (!string.Equals(Path.GetExtension(fileName), ".txt", StringComparison.OrdinalIgnoreCase))
            throw new BookImportException("Only .txt files can be imported.");

        var bookTitle = string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(fileName).Trim() : title.Trim();
        if (bookTitle.Length is 0 or > MaxTitleLength)
            throw new BookImportException($"The title must be between 1 and {MaxTitleLength} characters.");

        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        var text = BookParser.Decode(buffer.ToArray());
        if (string.IsNullOrWhiteSpace(text))
            throw new BookImportException("The file is empty.");

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
}
