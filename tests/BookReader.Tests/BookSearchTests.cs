using System.Net;
using System.Net.Http.Json;
using System.Text;
using BookReader.Api.Controllers;
using BookReader.Core.Audio;
using BookReader.Core.Books;
using BookReader.Core.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace BookReader.Tests;

public sealed class BookSearchTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly AppDbContext _db;
    private readonly BookLibraryService _service;

    public BookSearchTests()
    {
        _connection.Open();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
        _service = new BookLibraryService(_db, new AudioStorage(Path.Combine(Path.GetTempPath(), "bookreader-unused"), NullLogger<AudioStorage>.Instance));
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    /// <summary>Adds a book; each inner list is one chapter's paragraphs.</summary>
    private async Task<int> AddBook(params string[][] chapters)
    {
        var book = new Book
        {
            Title = "B",
            ImportedAt = DateTime.UtcNow,
            Chapters = chapters.Select((paragraphs, i) => new Chapter
            {
                Index = i,
                Title = $"Chapter {i}",
                Paragraphs = paragraphs.Select((text, j) => new Paragraph { Index = j, Text = text }).ToList(),
            }).ToList(),
        };
        _db.Books.Add(book);
        await _db.SaveChangesAsync();
        return book.Id;
    }

    [Theory]
    [InlineData("THE QUICK fox")]
    [InlineData("quick, fox!")] // punctuation in the query is ignored
    [InlineData("  quick    fox  ")] // extra spaces
    [InlineData("quick")]
    public async Task Matching_ignores_case_punctuation_and_spaces(string query)
    {
        var id = await AddBook(["Nothing here.", "The quick... fox (jumps)."]);

        var result = await _service.SearchAsync(id, query);

        var match = Assert.Single(result!.Matches);
        Assert.Equal((0, "Chapter 0", 1), (match.ChapterIndex, match.ChapterTitle, match.ParagraphIndex));
        Assert.False(result.HasMore);
    }

    [Theory]
    [InlineData("dont")]
    [InlineData("don't")]
    [InlineData("DON’T")]
    public async Task Apostrophe_inside_a_word_is_dropped_on_both_sides(string query)
    {
        var id = await AddBook(["I don't know", "I dont care"]);

        var result = await _service.SearchAsync(id, query);

        Assert.Equal([0, 1], result!.Matches.Select(m => m.ParagraphIndex));
    }

    [Fact]
    public async Task Words_must_be_in_order_and_adjacent()
    {
        var id = await AddBook(["red apple pie"]);

        Assert.Single((await _service.SearchAsync(id, "apple pie"))!.Matches);
        Assert.Empty((await _service.SearchAsync(id, "pie apple"))!.Matches); // wrong order
        Assert.Empty((await _service.SearchAsync(id, "red pie"))!.Matches); // not next to each other
        Assert.Empty((await _service.SearchAsync(id, "app"))!.Matches); // whole words only
    }

    [Fact]
    public async Task Phrase_is_not_found_across_paragraphs()
    {
        var id = await AddBook(["He said hello", "world to all"]);

        Assert.Empty((await _service.SearchAsync(id, "hello world"))!.Matches);
    }

    [Fact]
    public async Task Matches_come_in_book_order_across_chapters()
    {
        var id = await AddBook(["cat one", "no", "cat two"], ["cat three"]);

        var result = await _service.SearchAsync(id, "cat");

        Assert.Equal([(0, 0), (0, 2), (1, 0)], result!.Matches.Select(m => (m.ChapterIndex, m.ParagraphIndex)));
    }

    [Fact]
    public async Task Other_books_are_not_searched()
    {
        var other = await AddBook(["cat"]);
        var id = await AddBook(["dog"]);

        Assert.Empty((await _service.SearchAsync(id, "cat"))!.Matches);
        Assert.Single((await _service.SearchAsync(other, "cat"))!.Matches);
    }

    [Fact]
    public async Task Result_is_limited_to_50_and_flags_more()
    {
        var id = await AddBook(Enumerable.Range(0, 51).Select(i => $"cat {i}").ToArray());

        var result = await _service.SearchAsync(id, "cat");

        Assert.Equal(50, result!.Matches.Count);
        Assert.True(result.HasMore);
        Assert.Equal(49, result.Matches[^1].ParagraphIndex);
    }

    [Fact]
    public async Task Exactly_50_matches_do_not_flag_more()
    {
        var id = await AddBook(Enumerable.Range(0, 50).Select(i => $"cat {i}").ToArray());

        var result = await _service.SearchAsync(id, "cat");

        Assert.Equal(50, result!.Matches.Count);
        Assert.False(result.HasMore);
    }

    [Fact]
    public async Task Unknown_book_gives_null() =>
        Assert.Null(await _service.SearchAsync(999, "cat"));

    [Fact]
    public async Task Query_with_only_punctuation_finds_nothing()
    {
        var id = await AddBook(["Hello, world!"]);

        Assert.Empty((await _service.SearchAsync(id, "!?"))!.Matches);
    }

    [Fact]
    public void Snippet_is_cut_at_word_edges_around_the_match()
    {
        // 30 words of 10 chars each ("wordNNNNN ") before and after the target phrase.
        string Words(int from, int count) => string.Join(' ', Enumerable.Range(from, count).Select(i => $"word{i:00000}"));
        var text = $"{Words(0, 30)} target phrase {Words(100, 30)}";

        var snippet = BookTextSearch.FindSnippet(text, BookTextSearch.NormalizeWords("Target, PHRASE"))!;

        Assert.Contains("target phrase", snippet);
        var before = snippet[..snippet.IndexOf("target", StringComparison.Ordinal)];
        var after = snippet[(snippet.IndexOf("phrase", StringComparison.Ordinal) + "phrase".Length)..];
        Assert.InRange(before.Length, 90, 101);
        Assert.InRange(after.Length, 90, 101);
        // Whole words only: the first and last words are complete.
        Assert.StartsWith("word", snippet);
        Assert.Matches(@"word\d{5}$", snippet);
    }

    [Fact]
    public void Short_text_gives_the_whole_text_as_snippet() =>
        Assert.Equal("Hello, big world.", BookTextSearch.FindSnippet("Hello, big world.", ["big"]));
}

public sealed class BookSearchEndpointTests : ApiTestBase
{
    [Fact]
    public async Task Search_returns_matches_and_validates_query_and_book()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(Encoding.UTF8.GetBytes("Chapter 1: A\n\nOne red fox.\n\nTwo dogs.")), "file", "story.txt" },
        };
        var imported = await (await client.PostAsync("/api/books", form)).Content.ReadFromJsonAsync<ImportBookResponse>();

        var ok = await client.GetFromJsonAsync<SearchResponse>($"/api/books/{imported!.Id}/search?q=RED,%20fox");
        var match = Assert.Single(ok!.Matches);
        Assert.Equal((0, 0), (match.ChapterIndex, match.ParagraphIndex));
        Assert.False(ok.HasMore);

        var tooShort = await client.GetAsync($"/api/books/{imported.Id}/search?q=%20a%20");
        Assert.Equal(HttpStatusCode.BadRequest, tooShort.StatusCode);
        Assert.Contains("at least 2", await tooShort.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/books/{imported.Id}/search")).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/books/999/search?q=fox")).StatusCode);
    }
}
