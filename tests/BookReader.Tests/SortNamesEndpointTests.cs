using System.Net.Http.Json;
using BookReader.Api.Controllers;

namespace BookReader.Tests;

public sealed class SortNamesEndpointTests : ApiTestBase
{
    private async Task<List<string>?> SortAsync(params string[] names)
    {
        await using var app = NewApp();
        using var client = app.CreateClient();
        var response = await client.PostAsJsonAsync("/api/books/sort-names", new SortNamesRequest([.. names]));
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<List<string>>();
    }

    [Fact]
    public async Task Sorts_numbers_by_value()
    {
        Assert.Equal(["ch1.txt", "ch2.txt", "ch10.txt"], await SortAsync("ch10.txt", "ch1.txt", "ch2.txt"));
    }

    [Fact]
    public async Task Ignores_case()
    {
        Assert.Equal(["a2.txt", "B1.txt", "c3.txt"], await SortAsync("c3.txt", "B1.txt", "a2.txt"));
    }

    [Fact]
    public async Task Empty_list_gives_empty_list()
    {
        Assert.Empty((await SortAsync())!);
    }
}
