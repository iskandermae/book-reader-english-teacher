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
    public async Task Bad_file_gives_400_problem_details()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();

        var response = await client.PostAsync("/api/books", Form([], "empty.txt"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("empty", await response.Content.ReadAsStringAsync());
    }
}
