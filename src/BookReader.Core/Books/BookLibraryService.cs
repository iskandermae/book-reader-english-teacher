using BookReader.Core.Data;
using Microsoft.EntityFrameworkCore;

namespace BookReader.Core.Books;

/// <summary>A book in the library list (no chapter or paragraph text).</summary>
public record BookSummary(int Id, string Title, int ChapterCount, DateTime ImportedAt, DateTime? LastOpenedAt);

public interface IBookLibraryService
{
    /// <summary>Lists all books: last opened first, then most recently imported.</summary>
    Task<List<BookSummary>> ListAsync(CancellationToken ct = default);

    /// <summary>Deletes a book with its chapters and paragraphs. Returns false when the id is unknown.</summary>
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
}

public class BookLibraryService(AppDbContext db) : IBookLibraryService
{
    public Task<List<BookSummary>> ListAsync(CancellationToken ct = default) =>
        db.Books
            // SQLite sorts NULL first in ascending order, so descending puts never-opened books last.
            .OrderByDescending(b => b.LastOpenedAt)
            .ThenByDescending(b => b.ImportedAt)
            .ThenByDescending(b => b.Id) // stable tie-break
            .Select(b => new BookSummary(b.Id, b.Title, b.Chapters.Count, b.ImportedAt, b.LastOpenedAt))
            .ToListAsync(ct);

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        // Chapters and paragraphs go with the book through the cascade-delete foreign keys.
        var deleted = await db.Books.Where(b => b.Id == id).ExecuteDeleteAsync(ct);
        return deleted > 0;
    }
}
