using System.Net;
using System.Net.Http.Json;
using System.Text;
using BookReader.Api.Controllers;

namespace BookReader.Tests;

public sealed class BooksEndpointTests : ApiTestBase
{
    private static MultipartFormDataContent Form(byte[] bytes, string fileName, string? title = null)
    {
        var form = new MultipartFormDataContent { { new ByteArrayContent(bytes), "file", fileName } };
        if (title is not null)
            form.Add(new StringContent(title), "title");
        return form;
    }

    [Fact]
    public async Task Import_returns_id_title_and_chapter_count()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();

        var response = await client.PostAsync("/api/books",
            Form(Encoding.UTF8.GetBytes("Chapter 1: A\n\nText\n\nChapter 2: B\n\nMore"), "story.txt"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ImportBookResponse>();
        Assert.Equal(new ImportBookResponse(body!.Id, "story", 2), body);
        Assert.True(body.Id > 0);
    }

    [Fact]
    public async Task List_returns_imported_books_and_delete_removes_them()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        Assert.Empty((await client.GetFromJsonAsync<List<BookSummaryResponse>>("/api/books"))!);

        var imported = await (await client.PostAsync("/api/books",
            Form(Encoding.UTF8.GetBytes("Chapter 1: A\n\nText\n\nChapter 2: B\n\nMore"), "story.txt")))
            .Content.ReadFromJsonAsync<ImportBookResponse>();

        var list = await client.GetFromJsonAsync<List<BookSummaryResponse>>("/api/books");
        var item = Assert.Single(list!);
        Assert.Equal((imported!.Id, "story", 2), (item.Id, item.Title, item.ChapterCount));
        Assert.Null(item.LastOpenedAt);

        var deleted = await client.DeleteAsync($"/api/books/{imported.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<List<BookSummaryResponse>>("/api/books"))!);
    }

    [Fact]
    public async Task Chapter_list_and_chapter_text_are_returned()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        var imported = await (await client.PostAsync("/api/books",
            Form(Encoding.UTF8.GetBytes("Chapter 1: A\n\nOne\n\nTwo\n\nChapter 2: B\n\nMore"), "story.txt")))
            .Content.ReadFromJsonAsync<ImportBookResponse>();

        var list = await client.GetFromJsonAsync<BookChaptersResponse>($"/api/books/{imported!.Id}/chapters");
        Assert.Equal((imported.Id, "story"), (list!.BookId, list.Title));
        Assert.Equal([0, 1], list.Chapters.Select(c => c.Index));
        Assert.Equal([2, 1], list.Chapters.Select(c => c.ParagraphCount));

        var chapter = await client.GetFromJsonAsync<ChapterResponse>($"/api/books/{imported.Id}/chapters/0");
        Assert.Equal((imported.Id, 0), (chapter!.BookId, chapter.Index));
        Assert.Equal(["One", "Two"], chapter.Paragraphs);
    }

    [Theory]
    [InlineData("/api/books/999/chapters")]
    [InlineData("/api/books/999/chapters/0")]
    public async Task Chapter_routes_give_404_for_unknown_book(string url)
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(url)).StatusCode);
    }

    [Fact]
    public async Task Unknown_chapter_index_gives_404()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        var imported = await (await client.PostAsync("/api/books",
            Form(Encoding.UTF8.GetBytes("Chapter 1: A\n\nText"), "story.txt")))
            .Content.ReadFromJsonAsync<ImportBookResponse>();

        var response = await client.GetAsync($"/api/books/{imported!.Id}/chapters/7");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Position_defaults_then_saves_and_updates_last_opened()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        var imported = await (await client.PostAsync("/api/books",
            Form(Encoding.UTF8.GetBytes("Chapter 1: A\n\nOne\n\nTwo\n\nChapter 2: B\n\nMore"), "story.txt")))
            .Content.ReadFromJsonAsync<ImportBookResponse>();
        var url = $"/api/books/{imported!.Id}/position";

        Assert.Equal(new ReadingPositionDto(0, 0), await client.GetFromJsonAsync<ReadingPositionDto>(url));

        var put = await client.PutAsJsonAsync(url, new ReadingPositionDto(0, 1));
        Assert.Equal(HttpStatusCode.NoContent, put.StatusCode);
        Assert.Equal(new ReadingPositionDto(0, 1), await client.GetFromJsonAsync<ReadingPositionDto>(url));
        var list = await client.GetFromJsonAsync<List<BookSummaryResponse>>("/api/books");
        Assert.NotNull(list![0].LastOpenedAt);
    }

    [Theory]
    [InlineData(9, 0)]
    [InlineData(0, -1)]
    [InlineData(0, 2)]
    public async Task Saving_an_invalid_position_gives_400(int chapter, int paragraph)
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        var imported = await (await client.PostAsync("/api/books",
            Form(Encoding.UTF8.GetBytes("Chapter 1: A\n\nOne\n\nTwo"), "story.txt")))
            .Content.ReadFromJsonAsync<ImportBookResponse>();

        var response = await client.PutAsJsonAsync($"/api/books/{imported!.Id}/position", new ReadingPositionDto(chapter, paragraph));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Position_routes_give_404_for_unknown_book()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/books/999/position")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync("/api/books/999/position", new ReadingPositionDto(0, 0))).StatusCode);
    }

    [Fact]
    public async Task Delete_unknown_book_gives_404()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();

        var response = await client.DeleteAsync("/api/books/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Bad_file_gives_400_problem_details()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();

        var response = await client.PostAsync("/api/books", Form([], "empty.txt"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("empty", await response.Content.ReadAsStringAsync());
    }
}
