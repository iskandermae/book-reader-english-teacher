using System.Diagnostics;
using System.Text;
using BookReader.Core.Books;
using BookReader.Core.Data;
using BookReader.Core.Settings;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace BookReader.Tests;

public sealed class BookImportTests : IDisposable
{
    // In-memory SQLite lives as long as the connection is open: fast, real SQL, no files.
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;
    private readonly BookImportService _service;

    public BookImportTests()
    {
        _connection.Open();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
        _settings = new SettingsService(_db);
        _service = new BookImportService(_db, _settings);
    }

    private Task<BookImportResult> Import(string text, string fileName = "my-book.txt", string? title = null) =>
        Import(Encoding.UTF8.GetBytes(text), fileName, title);

    private Task<BookImportResult> Import(byte[] bytes, string fileName = "my-book.txt", string? title = null) =>
        _service.ImportAsync(new MemoryStream(bytes), fileName, title);

    private async Task<List<Chapter>> StoredChapters(int bookId) =>
        await _db.Chapters.Include(c => c.Paragraphs.OrderBy(p => p.Index)).Where(c => c.BookId == bookId).OrderBy(c => c.Index).ToListAsync();

    [Fact]
    public async Task Hpmor_style_headings_become_chapters_with_paragraphs()
    {
        var result = await Import("Chapter 1: A Day of Very Low Probability\n\nFirst.\n\n  Second  \n\n\nThird\nline.\n\nChapter 2: Next\n\nOnly one.\n");

        Assert.Equal(2, result.ChapterCount);
        Assert.Equal("my-book", result.Title); // default: file name without extension
        var chapters = await StoredChapters(result.BookId);
        Assert.Equal("Chapter 1: A Day of Very Low Probability", chapters[0].Title);
        Assert.Equal(["First.", "Second", "Third\nline."], chapters[0].Paragraphs.Select(p => p.Text));
        Assert.Equal("Chapter 2: Next", chapters[1].Title);
        Assert.Equal(["Only one."], chapters[1].Paragraphs.Select(p => p.Text));
    }

    [Fact]
    public async Task Explicit_title_wins_over_file_name()
    {
        var result = await Import("Hello", title: "  My Title ");

        Assert.Equal("My Title", result.Title);
    }

    [Fact]
    public async Task Text_without_headings_is_a_single_chapter_named_after_the_book()
    {
        var result = await Import("One.\r\n\r\nTwo.", title: "Plain");

        Assert.Equal(1, result.ChapterCount);
        var chapter = Assert.Single(await StoredChapters(result.BookId));
        Assert.Equal("Plain", chapter.Title);
        Assert.Equal(["One.", "Two."], chapter.Paragraphs.Select(p => p.Text));
    }

    [Fact]
    public async Task Text_before_the_first_heading_goes_to_the_first_chapter()
    {
        var result = await Import("Preface text.\n\nChapter 1: Start\n\nBody.\n\nChapter 2: End\n\nLast.");

        Assert.Equal(2, result.ChapterCount);
        var chapters = await StoredChapters(result.BookId);
        Assert.Equal("Chapter 1: Start", chapters[0].Title);
        Assert.Equal(["Preface text.", "Body."], chapters[0].Paragraphs.Select(p => p.Text));
    }

    [Fact]
    public async Task Utf8_with_bom_is_accepted_and_the_bom_is_removed()
    {
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes("Chapter 1: Zażółć\n\nText")).ToArray();

        var result = await Import(bytes);

        Assert.Equal("Chapter 1: Zażółć", (await StoredChapters(result.BookId))[0].Title);
    }

    [Fact]
    public async Task Non_utf8_file_gives_a_clear_error()
    {
        var latin1 = Encoding.Latin1.GetBytes("Chapter 1\n\nCafé au lait");

        var ex = await Assert.ThrowsAsync<BookImportException>(() => Import(latin1));

        Assert.Contains("UTF-8", ex.Message);
        Assert.Empty(_db.Books);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" \n\r\n\t ")]
    public async Task Empty_file_gives_a_clear_error(string text)
    {
        var ex = await Assert.ThrowsAsync<BookImportException>(() => Import(text));

        Assert.Contains("empty", ex.Message);
    }

    [Fact]
    public async Task Non_txt_file_is_rejected()
    {
        await Assert.ThrowsAsync<BookImportException>(() => Import("text", "book.epub"));
    }

    [Fact]
    public async Task Custom_chapter_regex_setting_is_used()
    {
        await _settings.UpdateAsync(new Dictionary<string, string?> { [SettingsService.ChapterRegex] = @"^PART \w+$" });

        var result = await Import("PART ONE\n\nA\n\nPART TWO\n\nB");

        Assert.Equal(2, result.ChapterCount);
    }

    [Fact]
    public async Task Invalid_chapter_regex_is_rejected_when_saved()
    {
        var ex = await Assert.ThrowsAsync<SettingsValidationException>(() => _settings.UpdateAsync(
            new Dictionary<string, string?> { [SettingsService.ChapterRegex] = "(unclosed" }));

        Assert.Contains("regular expression", ex.Message);
    }

    [Fact]
    public async Task Invalid_chapter_regex_already_stored_gives_import_error_not_a_crash()
    {
        // Bypasses validation, as if the row came from an older version or was edited by hand.
        _db.Settings.Add(new Setting { Key = SettingsService.ChapterRegex, Value = "(unclosed" });
        await _db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<BookImportException>(() => Import("Text"));

        Assert.Contains("regular expression", ex.Message);
    }

    [Fact]
    public async Task Importing_the_same_book_twice_creates_two_books()
    {
        var first = await Import("Chapter 1: A\n\nText");
        var second = await Import("Chapter 1: A\n\nText");

        Assert.NotEqual(first.BookId, second.BookId);
    }

    [Fact]
    public async Task Sample_book_imports_as_one_chapter()
    {
        var path = Path.Combine(FindRepoRoot(), "book", "1.txt");
        Assert.True(File.Exists(path), $"Sample book is missing: {path}");

        var result = await Import(await File.ReadAllBytesAsync(path), "1.txt");

        Assert.Equal(1, result.ChapterCount);
    }

    [Fact]
    public async Task Large_generated_book_imports_within_a_few_seconds()
    {
        var text = new StringBuilder();
        for (var chapter = 1; text.Length < 5_000_000; chapter++)
        {
            text.Append($"Chapter {chapter}: Generated\n\n");
            for (var p = 0; p < 100; p++)
                text.Append("Harry looked at the strange sentence and wondered how long it would take to read it all.\n\n");
        }

        // The limit is generous on purpose: typical runs take about a second, but a loaded CI machine must not make this flaky.
        // It still catches real regressions (e.g. quadratic parsing).
        var watch = Stopwatch.StartNew();
        var result = await Import(text.ToString());
        watch.Stop();

        Assert.True(result.ChapterCount > 40);
        Assert.True(watch.Elapsed < TimeSpan.FromSeconds(10), $"Import took {watch.Elapsed}.");
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "BookReader.sln")))
            dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Repo root (BookReader.sln) not found.");
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }
}
