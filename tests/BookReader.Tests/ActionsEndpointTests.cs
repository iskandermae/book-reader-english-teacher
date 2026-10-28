using System.Net;
using System.Net.Http.Json;
using BookReader.Api.Controllers;
using BookReader.Core.Actions;
using BookReader.Core.Llm;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace BookReader.Tests;

/// <summary>Custom actions: storage, validation, seeding and running (fake provider, no network).</summary>
public sealed class ActionsEndpointTests : ApiTestBase
{
    private readonly FakeLlmProvider _llm = new();

    private WebApplicationFactory<Program> NewAppWithFakeLlm() =>
        NewApp().WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddScoped<ILlmProvider>(_ => _llm)));

    private static CustomActionInput New(string name, string prompt = "Do {selection}") => new(name, prompt);

    private static async Task<IReadOnlyList<CustomActionDto>> ListAsync(HttpClient c) =>
        (await c.GetFromJsonAsync<List<CustomActionDto>>("/api/actions"))!;

    [Fact]
    public async Task First_start_seeds_the_simplify_action()
    {
        await using var app = NewApp();
        using var client = app.CreateClient();

        var list = await ListAsync(client);

        var simplify = Assert.Single(list);
        Assert.Equal("Simplify (B2)", simplify.Name);
        Assert.Empty(PromptTemplate.Validate(simplify.Prompt));
    }

    [Fact]
    public async Task Deleting_the_seeded_action_is_final_after_restart()
    {
        await using (var app = NewApp())
        {
            using var client = app.CreateClient();
            await client.PutAsJsonAsync("/api/actions", Array.Empty<CustomActionInput>());
            Assert.Empty(await ListAsync(client));
        }

        await using var restarted = NewApp();
        using var client2 = restarted.CreateClient();
        Assert.Empty(await ListAsync(client2));
    }

    [Fact]
    public async Task Put_replaces_the_list_keeps_order_and_ids_and_deletes_the_rest()
    {
        await using var app = NewApp();
        using var client = app.CreateClient();
        var seeded = (await ListAsync(client)).Single();

        var saved = (await (await client.PutAsJsonAsync("/api/actions",
            new[] { New("Second"), new CustomActionInput("  Renamed ", "New {selection}", seeded.Id) }))
            .Content.ReadFromJsonAsync<List<CustomActionDto>>())!;

        Assert.Equal(["Second", "Renamed"], saved.Select(a => a.Name));
        Assert.Equal(seeded.Id, saved[1].Id);
        Assert.Equal("New {selection}", saved[1].Prompt);
        Assert.NotEqual(seeded.Id, saved[0].Id);
        Assert.Equal(saved, await ListAsync(client));

        // Leaving an action out deletes it.
        await client.PutAsJsonAsync("/api/actions", new[] { new CustomActionInput("Second", "Do {selection}", saved[0].Id) });
        Assert.Equal(["Second"], (await ListAsync(client)).Select(a => a.Name));
    }

    [Fact]
    public async Task Put_accepts_20_actions_and_an_unknown_id_becomes_a_new_action()
    {
        await using var app = NewApp();
        using var client = app.CreateClient();
        var twenty = Enumerable.Range(0, 20).Select(i => New($"A{i}")).ToList();
        twenty[0] = new CustomActionInput("A0", "Do {selection}", 9999);

        var response = await client.PutAsJsonAsync("/api/actions", twenty);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var saved = await ListAsync(client);
        Assert.Equal(20, saved.Count);
        Assert.DoesNotContain(saved, a => a.Id == 9999);
    }

    public static TheoryData<string, CustomActionInput[]> InvalidLists() => new()
    {
        { "Too many actions", Enumerable.Range(0, 21).Select(i => New($"A{i}")).ToArray() },
        { "name must be 1-40", [New("   ")] },
        { "name must be 1-40", [New(new string('x', 41))] },
        { "used twice", [New("Same"), New(" same ")] },
        { "id 5 is used twice", [new CustomActionInput("A", "{selection}", 5), new CustomActionInput("B", "{selection}", 5)] },
        { "too long", [New("A", "{selection}" + new string('x', 4000))] },
        { "must contain {selection}", [New("A", "no selection")] },
        { "Unknown placeholder '{nope}'", [New("A", "{selection} {nope}")] },
    };

    [Theory]
    [MemberData(nameof(InvalidLists))]
    public async Task Put_returns_400_and_saves_nothing_for_an_invalid_list(string expectedDetail, CustomActionInput[] list)
    {
        await using var app = NewApp();
        using var client = app.CreateClient();

        // The valid first entry proves that one bad entry rejects the whole request.
        var response = await client.PutAsJsonAsync("/api/actions", list.Prepend(New("Valid")));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(expectedDetail, (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        Assert.Equal(["Simplify (B2)"], (await ListAsync(client)).Select(a => a.Name));
    }

    [Fact]
    public async Task Run_action_streams_the_answer_using_the_action_template()
    {
        _llm.Chunks = ["easy"];
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();
        var saved = (await (await client.PutAsJsonAsync("/api/actions",
            new[] { New("Mine", "M[{selection}|{sentence}|{paragraph}|{native_language}]") })).Content.ReadFromJsonAsync<List<CustomActionDto>>())!;

        var response = await client.PostAsJsonAsync($"/api/llm/actions/{saved[0].Id}", new ActionRequest("Hello", "Sentence.", "Paragraph."));

        Assert.Equal("text/event-stream", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("data: \"easy\"\n\nevent: done\ndata: \n\n", await response.Content.ReadAsStringAsync());
        Assert.Equal("M[Hello|Sentence.|Paragraph.|Ukrainian]", _llm.LastPrompt);
    }

    [Fact]
    public async Task Run_action_uses_the_seeded_simplify_prompt()
    {
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();

        await client.PostAsJsonAsync($"/api/llm/actions/{CustomAction.SimplifyId}", new ActionRequest("Hello"));

        Assert.Contains("B2", _llm.LastPrompt);
        Assert.Contains("Text: Hello", _llm.LastPrompt);
    }

    [Fact]
    public async Task Run_action_returns_404_for_an_unknown_id()
    {
        await AssertProblemAsync(c => c.PostAsJsonAsync("/api/llm/actions/999", new ActionRequest("Hello")), HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public async Task Run_action_returns_400_for_blank_text(string text)
    {
        await AssertProblemAsync(c => c.PostAsJsonAsync($"/api/llm/actions/{CustomAction.SimplifyId}", new ActionRequest(text)),
            HttpStatusCode.BadRequest, "Text must not be empty.");
    }

    [Fact]
    public async Task Run_action_returns_400_when_no_model_is_chosen()
    {
        _llm.Failure = new LlmNotConfiguredException("Choose a model in settings.");
        await AssertProblemAsync(c => c.PostAsJsonAsync($"/api/llm/actions/{CustomAction.SimplifyId}", new ActionRequest("Hello")),
            HttpStatusCode.BadRequest, "Choose a model in settings.");
    }

    [Fact]
    public async Task Run_action_returns_503_with_hint_when_ollama_is_down()
    {
        _llm.Failure = new LlmUnavailableException("Start Ollama.");
        await AssertProblemAsync(c => c.PostAsJsonAsync($"/api/llm/actions/{CustomAction.SimplifyId}", new ActionRequest("Hello")),
            HttpStatusCode.ServiceUnavailable, "Start Ollama.");
    }

    private async Task AssertProblemAsync(Func<HttpClient, Task<HttpResponseMessage>> call, HttpStatusCode status, string? detail = null)
    {
        await using var app = NewAppWithFakeLlm();
        using var client = app.CreateClient();

        var response = await call(client);

        Assert.Equal(status, response.StatusCode);
        if (detail is not null)
            Assert.Equal(detail, (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }
}
