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
