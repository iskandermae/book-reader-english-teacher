using BookReader.Core.Data;
using Microsoft.EntityFrameworkCore;

namespace BookReader.Core.Books;

/// <summary>A book in the library list (no chapter or paragraph text).</summary>
public record BookSummary(int Id, string Title, int ChapterCount, DateTime ImportedAt, DateTime? LastOpenedAt);

/// <summary>One entry of a book's chapter list (no paragraph text).</summary>
public record ChapterSummary(int Index, string Title, int ParagraphCount);

/// <summary>A book's title and its chapters in reading order.</summary>
public record BookChapterList(int BookId, string Title, List<ChapterSummary> Chapters);

/// <summary>One chapter's text; the paragraph array position is the paragraph index.</summary>
public record ChapterText(int BookId, int Index, string Title, List<string> Paragraphs);

/// <summary>Where the reader stopped in a book (both zero-based).</summary>
public record ReadingPosition(int ChapterIndex, int ParagraphIndex);

public enum SavePositionResult { Saved, BookNotFound, ChapterNotFound, ParagraphOutOfRange }

public interface IBookLibraryService
{
    /// <summary>Gets the saved position, or 0/0 when none is saved. Null when the book is unknown. Does not touch LastOpenedAt.</summary>
    Task<ReadingPosition?> GetPositionAsync(int bookId, CancellationToken ct = default);

    /// <summary>Validates and saves the position and sets LastOpenedAt to now. Nothing is changed unless the result is Saved.</summary>
    Task<SavePositionResult> SavePositionAsync(int bookId, ReadingPosition position, CancellationToken ct = default);

    /// <summary>Lists all books: last opened first, then most recently imported.</summary>
    Task<List<BookSummary>> ListAsync(CancellationToken ct = default);

    /// <summary>Lists a book's chapters without reading paragraph text. Null when the book is unknown.</summary>
    Task<BookChapterList?> GetChaptersAsync(int bookId, CancellationToken ct = default);

    /// <summary>Gets one chapter with all its paragraphs. Null when the book or chapter index is unknown.</summary>
    Task<ChapterText?> GetChapterAsync(int bookId, int index, CancellationToken ct = default);

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

    public async Task<BookChapterList?> GetChaptersAsync(int bookId, CancellationToken ct = default)
    {
        // Paragraphs.Count is translated to SQL, so paragraph text is never loaded.
        var book = await db.Books
            .Where(b => b.Id == bookId)
            .Select(b => new
            {
                b.Title,
                Chapters = b.Chapters
                    .OrderBy(c => c.Index)
                    .Select(c => new ChapterSummary(c.Index, c.Title, c.Paragraphs.Count))
                    .ToList(),
            })
            .FirstOrDefaultAsync(ct);
        return book is null ? null : new BookChapterList(bookId, book.Title, book.Chapters);
    }

    public async Task<ChapterText?> GetChapterAsync(int bookId, int index, CancellationToken ct = default)
    {
        var chapter = await db.Chapters
            .Where(c => c.BookId == bookId && c.Index == index)
            .Select(c => new
            {
                c.Title,
                Paragraphs = c.Paragraphs.OrderBy(p => p.Index).Select(p => p.Text).ToList(),
            })
            .FirstOrDefaultAsync(ct);
        return chapter is null ? null : new ChapterText(bookId, index, chapter.Title, chapter.Paragraphs);
    }

    public async Task<ReadingPosition?> GetPositionAsync(int bookId, CancellationToken ct = default)
    {
        var book = await db.Books
            .Where(b => b.Id == bookId)
            .Select(b => new { b.PositionChapterIndex, b.PositionParagraphIndex })
            .FirstOrDefaultAsync(ct);
        return book is null ? null : new ReadingPosition(book.PositionChapterIndex ?? 0, book.PositionParagraphIndex ?? 0);
    }

    public async Task<SavePositionResult> SavePositionAsync(int bookId, ReadingPosition position, CancellationToken ct = default)
    {
        var book = await db.Books.FirstOrDefaultAsync(b => b.Id == bookId, ct);
        if (book is null)
            return SavePositionResult.BookNotFound;

        // Only the paragraph count is needed, never the text.
        var paragraphCount = await db.Chapters
            .Where(c => c.BookId == bookId && c.Index == position.ChapterIndex)
            .Select(c => (int?)c.Paragraphs.Count)
            .FirstOrDefaultAsync(ct);
        if (paragraphCount is null)
            return SavePositionResult.ChapterNotFound;
        if (position.ParagraphIndex < 0 || position.ParagraphIndex >= paragraphCount)
            return SavePositionResult.ParagraphOutOfRange;

        book.PositionChapterIndex = position.ChapterIndex;
        book.PositionParagraphIndex = position.ParagraphIndex;
        book.LastOpenedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return SavePositionResult.Saved;
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        // Chapters and paragraphs go with the book through the cascade-delete foreign keys.
        var deleted = await db.Books.Where(b => b.Id == id).ExecuteDeleteAsync(ct);
        return deleted > 0;
    }
}
