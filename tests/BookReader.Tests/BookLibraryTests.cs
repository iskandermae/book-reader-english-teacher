using BookReader.Core.Books;
using BookReader.Core.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace BookReader.Tests;

public sealed class BookLibraryTests : IDisposable
{
    // In-memory SQLite lives as long as the connection is open: real SQL (ordering, cascade), no files.
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly AppDbContext _db;
    private readonly BookLibraryService _service;

    public BookLibraryTests()
    {
        _connection.Open();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
        _service = new BookLibraryService(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private async Task<Book> AddBook(string title, DateTime importedAt, DateTime? lastOpenedAt = null, int chapters = 1)
    {
        var book = new Book
        {
            Title = title,
            ImportedAt = importedAt,
            LastOpenedAt = lastOpenedAt,
            Chapters = Enumerable.Range(0, chapters).Select(i => new Chapter
            {
                Index = i,
                Title = $"Chapter {i}",
                Paragraphs = [new Paragraph { Index = 0, Text = "text" }, new Paragraph { Index = 1, Text = "more" }],
            }).ToList(),
        };
        _db.Books.Add(book);
        await _db.SaveChangesAsync();
        return book;
    }

    [Fact]
    public async Task Empty_library_gives_empty_list() =>
        Assert.Empty(await _service.ListAsync());

    [Fact]
    public async Task List_orders_last_opened_first_then_newest_imported()
    {
        var day = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        await AddBook("never-old", day);
        await AddBook("opened-early", day.AddDays(1), lastOpenedAt: day.AddDays(10));
        await AddBook("never-new", day.AddDays(5));
        await AddBook("opened-late", day.AddDays(2), lastOpenedAt: day.AddDays(20));

        var titles = (await _service.ListAsync()).Select(b => b.Title);

        Assert.Equal(["opened-late", "opened-early", "never-new", "never-old"], titles);
    }

    [Fact]
    public async Task List_returns_chapter_counts_and_dates()
    {
        var imported = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        await AddBook("three", imported, chapters: 3);
        await AddBook("one", imported.AddDays(1), lastOpenedAt: imported.AddDays(2), chapters: 1);

        var list = await _service.ListAsync();

        Assert.Equal(1, list[0].ChapterCount);
        Assert.Equal(imported.AddDays(2), list[0].LastOpenedAt);
        Assert.Equal(3, list[1].ChapterCount);
        Assert.Null(list[1].LastOpenedAt);
        Assert.Equal(imported, list[1].ImportedAt);
    }

    [Fact]
    public async Task Delete_removes_book_chapters_and_paragraphs_but_keeps_others()
    {
        var now = DateTime.UtcNow;
        var doomed = await AddBook("doomed", now, chapters: 2);
        await AddBook("kept", now, chapters: 1);

        Assert.True(await _service.DeleteAsync(doomed.Id));

        Assert.Equal(["kept"], (await _service.ListAsync()).Select(b => b.Title));
        Assert.Equal(1, await _db.Chapters.CountAsync());
        Assert.Equal(2, await _db.Paragraphs.CountAsync());
    }

    [Fact]
    public async Task Delete_unknown_id_returns_false() =>
        Assert.False(await _service.DeleteAsync(12345));

    private async Task<Book> AddBookWith(string title, params Chapter[] chapters)
    {
        var book = new Book { Title = title, ImportedAt = DateTime.UtcNow, Chapters = chapters.ToList() };
        _db.Books.Add(book);
        await _db.SaveChangesAsync();
        return book;
    }

    private static Paragraph P(int index, string text) => new() { Index = index, Text = text };

    [Fact]
    public async Task Chapter_list_is_ordered_by_index_with_paragraph_counts()
    {
        // Inserted out of order to prove the service sorts.
        var book = await AddBookWith("b",
            new Chapter { Index = 1, Title = "Second", Paragraphs = [P(0, "x")] },
            new Chapter { Index = 0, Title = "First", Paragraphs = [P(0, "a"), P(1, "b")] });

        var list = await _service.GetChaptersAsync(book.Id);

        Assert.Equal((book.Id, "b"), (list!.BookId, list.Title));
        Assert.Equal([new ChapterSummary(0, "First", 2), new ChapterSummary(1, "Second", 1)], list.Chapters);
    }

    [Fact]
    public async Task Chapter_text_is_in_paragraph_order()
    {
        var book = await AddBookWith("b",
            new Chapter { Index = 0, Title = "One", Paragraphs = [P(2, "third"), P(0, "first"), P(1, "second")] });

        var chapter = await _service.GetChapterAsync(book.Id, 0);

        Assert.Equal((book.Id, 0, "One"), (chapter!.BookId, chapter.Index, chapter.Title));
        Assert.Equal(["first", "second", "third"], chapter.Paragraphs);
    }

    [Fact]
    public async Task Unknown_book_or_chapter_gives_null()
    {
        var book = await AddBook("b", DateTime.UtcNow, chapters: 1);

        Assert.Null(await _service.GetChaptersAsync(999));
        Assert.Null(await _service.GetChapterAsync(999, 0));
        Assert.Null(await _service.GetChapterAsync(book.Id, 5));
        Assert.Null(await _service.GetChapterAsync(book.Id, -1));
    }

    [Fact]
    public async Task Chapter_over_100k_characters_returns_all_paragraphs()
    {
        var paragraphs = Enumerable.Range(0, 1000).Select(i => P(i, $"{i}: {new string('x', 100)}")).ToList();
        Assert.True(paragraphs.Sum(p => p.Text.Length) > 100_000);
        var book = await AddBookWith("big", new Chapter { Index = 0, Title = "Long", Paragraphs = paragraphs });

        var chapter = await _service.GetChapterAsync(book.Id, 0);

        Assert.Equal(paragraphs.Select(p => p.Text), chapter!.Paragraphs);
    }
}
