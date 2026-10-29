using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using BookReader.Api.Controllers;

namespace BookReader.Tests;

public sealed class AudioEndpointTests : ApiTestBase
{
    private static readonly byte[] Bytes = Enumerable.Range(0, 200).Select(i => (byte)i).ToArray();

    private string AudioFolder => Path.Combine(DataFolderPath, "audio");

    /// <summary>Imports a book with three chapters and returns its id.</summary>
    private static async Task<int> ImportBookAsync(HttpClient client)
    {
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(Encoding.UTF8.GetBytes("Chapter 1: A\n\nOne\n\nChapter 2: B\n\nTwo\n\nChapter 3: C\n\nThree")), "file", "story.txt" },
        };
        var response = await client.PostAsync("/api/books", form);
        return (await response.Content.ReadFromJsonAsync<ImportBookResponse>())!.Id;
    }

    private static Task<HttpResponseMessage> UploadAsync(
        HttpClient client, int bookId, string fileName = "part.mp3", byte[]? bytes = null, int? from = null, int? to = null)
    {
        var form = new MultipartFormDataContent { { new ByteArrayContent(bytes ?? Bytes), "file", fileName } };
        if (from is not null) form.Add(new StringContent(from.ToString()!), "fromChapter");
        if (to is not null) form.Add(new StringContent(to.ToString()!), "toChapter");
        return client.PostAsync($"/api/books/{bookId}/audio", form);
    }

    private static async Task<AudioFileResponse> UploadOkAsync(HttpClient client, int bookId, int? from = null, int? to = null)
    {
        var response = await UploadAsync(client, bookId, from: from, to: to);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<AudioFileResponse>())!;
    }

    private static async Task AssertBadRequestAsync(HttpResponseMessage response, string expectedText)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(expectedText, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Upload_copies_the_file_and_defaults_to_the_whole_book()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        var bookId = await ImportBookAsync(client);

        var added = await UploadOkAsync(client, bookId);

        Assert.Equal((0, 2, "part.mp3", "audio/mpeg", (long)Bytes.Length), (added.FromChapter, added.ToChapter, added.FileName, added.ContentType, added.SizeBytes));
        var copy = Assert.Single(Directory.GetFiles(AudioFolder));
        Assert.Equal(Bytes, await File.ReadAllBytesAsync(copy));
        var list = await client.GetFromJsonAsync<List<AudioFileResponse>>($"/api/books/{bookId}/audio");
        Assert.Equal(added, Assert.Single(list!));
    }

    [Fact]
    public async Task Upload_rejects_unsupported_empty_and_missing_files_and_unknown_books()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        var bookId = await ImportBookAsync(client);

        await AssertBadRequestAsync(await UploadAsync(client, bookId, "notes.txt"), "Unsupported audio type");
        await AssertBadRequestAsync(await UploadAsync(client, bookId, bytes: []), "empty");
        await AssertBadRequestAsync(
            await client.PostAsync($"/api/books/{bookId}/audio", new MultipartFormDataContent { { new StringContent("1"), "fromChapter" } }),
            "No file");

        Assert.Equal(HttpStatusCode.NotFound, (await UploadAsync(client, 999)).StatusCode);
        Assert.Empty(await client.GetFromJsonAsync<List<AudioFileResponse>>($"/api/books/{bookId}/audio") ?? []);
        Assert.False(Directory.Exists(AudioFolder) && Directory.GetFiles(AudioFolder).Length > 0, "rejected uploads must leave no copy");
    }

    [Theory]
    [InlineData(-1, 1)]
    [InlineData(2, 1)]
    [InlineData(0, 3)]
    public async Task Upload_rejects_invalid_range(int from, int to)
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        var bookId = await ImportBookAsync(client);

        await AssertBadRequestAsync(await UploadAsync(client, bookId, from: from, to: to), "chapter range is invalid");
    }

    [Fact]
    public async Task Overlapping_ranges_are_rejected_on_upload_and_edit_but_touching_ranges_are_fine()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        var bookId = await ImportBookAsync(client);
        var first = await UploadOkAsync(client, bookId, 0, 1);

        await AssertBadRequestAsync(await UploadAsync(client, bookId, from: 1, to: 2), "overlaps");
        var second = await UploadOkAsync(client, bookId, 2, 2);

        await AssertBadRequestAsync(await client.PutAsJsonAsync($"/api/books/{bookId}/audio/{second.Id}", new AudioRangeRequest(1, 2)), "overlaps");
        // A file may keep or shrink its own range (it does not clash with itself).
        var shrunk = await client.PutAsJsonAsync($"/api/books/{bookId}/audio/{first.Id}", new AudioRangeRequest(0, 0));
        Assert.Equal(HttpStatusCode.OK, shrunk.StatusCode);
        Assert.Equal(0, (await shrunk.Content.ReadFromJsonAsync<AudioFileResponse>())!.ToChapter);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/books/{bookId}/audio/{second.Id}", new AudioRangeRequest(1, 2))).StatusCode);

        await AssertBadRequestAsync(await client.PutAsJsonAsync($"/api/books/{bookId}/audio/{first.Id}", new AudioRangeRequest(0, 5)), "chapter range is invalid");
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"/api/books/{bookId}/audio/999", new AudioRangeRequest(0, 0))).StatusCode);
    }

    [Fact]
    public async Task Delete_removes_the_row_and_the_copy()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        var bookId = await ImportBookAsync(client);
        var added = await UploadOkAsync(client, bookId);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/books/{bookId}/audio/{added.Id}")).StatusCode);

        Assert.Empty(Directory.GetFiles(AudioFolder));
        Assert.Empty((await client.GetFromJsonAsync<List<AudioFileResponse>>($"/api/books/{bookId}/audio"))!);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/api/books/{bookId}/audio/{added.Id}")).StatusCode);
    }

    [Fact]
    public async Task Deleting_a_book_deletes_its_audio_files()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        var bookId = await ImportBookAsync(client);
        var other = await ImportBookAsync(client);
        await UploadOkAsync(client, bookId, 0, 0);
        await UploadOkAsync(client, bookId, 1, 1);
        var kept = await UploadOkAsync(client, other);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/books/{bookId}")).StatusCode);

        Assert.Single(Directory.GetFiles(AudioFolder)); // only the other book's copy is left
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/books/{other}/audio/{kept.Id}/content")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/books/{bookId}/audio")).StatusCode);
    }

    [Fact]
    public async Task Content_supports_range_requests()
    {
        await using var factory = NewApp();
        using var client = factory.CreateClient();
        var bookId = await ImportBookAsync(client);
        var added = await UploadOkAsync(client, bookId);
        var url = $"/api/books/{bookId}/audio/{added.Id}/content";

        var whole = await client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, whole.StatusCode);
        Assert.Equal("audio/mpeg", whole.Content.Headers.ContentType!.MediaType);
        Assert.Equal("bytes", whole.Headers.AcceptRanges.Single());
        Assert.Equal(Bytes, await whole.Content.ReadAsByteArrayAsync());

        var request = new HttpRequestMessage(HttpMethod.Get, url) { Headers = { Range = new RangeHeaderValue(10, 19) } };
        var partial = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.PartialContent, partial.StatusCode);
        Assert.Equal(new ContentRangeHeaderValue(10, 19, Bytes.Length), partial.Content.Headers.ContentRange);
        Assert.Equal(Bytes[10..20], await partial.Content.ReadAsByteArrayAsync());

        var outside = new HttpRequestMessage(HttpMethod.Get, url) { Headers = { Range = new RangeHeaderValue(500, 600) } };
        Assert.Equal(HttpStatusCode.RequestedRangeNotSatisfiable, (await client.SendAsync(outside)).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/books/{bookId}/audio/999/content")).StatusCode);
    }
}
