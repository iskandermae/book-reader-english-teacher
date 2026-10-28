using BookReader.Core.Data;
using BookReader.Core.Settings;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace BookReader.Tests;

public sealed class SettingsServiceTests : IDisposable
{
    // In-memory SQLite lives as long as the connection is open: fast, real SQL, no files.
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly AppDbContext _db;
    private readonly SettingsService _service;

    public SettingsServiceTests()
    {
        _connection.Open();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();
        _service = new SettingsService(_db);
    }

    [Fact]
    public async Task GetAll_returns_defaults_when_nothing_saved()
    {
        var all = await _service.GetAllAsync();

        Assert.Equal(12, all.Count);
        Assert.Equal("English", all[SettingsService.LanguageFrom]);
        Assert.Equal(BookReader.Core.Llm.TranslatePrompt.DefaultTemplate, all[SettingsService.PromptTranslate]);
        Assert.Equal(BookReader.Core.Llm.ExplainPrompt.DefaultTemplate, all[SettingsService.PromptExplain]);
        Assert.Equal("40", all[SettingsService.ReaderPanelWidth]);
        Assert.Equal("Ukrainian", all[SettingsService.LanguageNative]);
        Assert.Equal("http://localhost:11434", all[SettingsService.OllamaUrl]);
        Assert.Equal("medium", all[SettingsService.ReaderFontSize]);
        Assert.Equal("light", all[SettingsService.ReaderTheme]);
        Assert.Equal("medium", all[SettingsService.ReaderWidth]);
        Assert.Equal("", all[SettingsService.OllamaModel]); // never hardcoded (D12)
        Assert.Equal("", all[SettingsService.UiSample]);
    }

    [Theory]
    [InlineData("Translate {text} {selection}", "Unknown placeholder '{text}'")]
    [InlineData("Translate this", "{selection}")]
    public async Task Update_rejects_invalid_prompt_template_and_saves_nothing(string template, string expected)
    {
        var ex = await Assert.ThrowsAsync<SettingsValidationException>(() => _service.UpdateAsync(new Dictionary<string, string?>
        {
            [SettingsService.LanguageNative] = "German",
            [SettingsService.PromptTranslate] = template,
        }));

        Assert.Contains(expected, ex.Message);
        Assert.Equal("Ukrainian", await _service.GetAsync(SettingsService.LanguageNative));
    }

    [Fact]
    public async Task Prompt_keys_allow_4000_characters_other_keys_stay_at_1000()
    {
        var longTemplate = "{selection}" + new string('a', SettingsService.MaxPromptLength - "{selection}".Length);
        await _service.UpdateAsync(new Dictionary<string, string?> { [SettingsService.PromptExplain] = longTemplate });
        Assert.Equal(longTemplate, await _service.GetAsync(SettingsService.PromptExplain));

        await Assert.ThrowsAsync<SettingsValidationException>(() =>
            _service.UpdateAsync(new Dictionary<string, string?> { [SettingsService.PromptExplain] = longTemplate + "a" }));
        await Assert.ThrowsAsync<SettingsValidationException>(() =>
            _service.UpdateAsync(new Dictionary<string, string?> { [SettingsService.LanguageFrom] = new string('a', 1001) }));
    }

    [Fact]
    public async Task Get_returns_default_then_saved_value_and_rejects_unknown_key()
    {
        Assert.Equal("Ukrainian", await _service.GetAsync(SettingsService.LanguageNative));

        await _service.UpdateAsync(new Dictionary<string, string?> { [SettingsService.LanguageNative] = "German" });

        Assert.Equal("German", await _service.GetAsync(SettingsService.LanguageNative));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.GetAsync("nope"));
    }

    [Fact]
    public async Task Update_saves_values_and_overwrites_existing_ones()
    {
        await _service.UpdateAsync(new Dictionary<string, string?> { [SettingsService.OllamaModel] = "a" });
        var all = await _service.UpdateAsync(new Dictionary<string, string?>
        {
            [SettingsService.OllamaModel] = "b",
            [SettingsService.UiSample] = "x",
        });

        Assert.Equal("b", all[SettingsService.OllamaModel]);
        Assert.Equal("x", all[SettingsService.UiSample]);
        Assert.Equal(all, await _service.GetAllAsync());
    }

    [Fact]
    public async Task Update_rejects_unknown_key_and_saves_nothing()
    {
        var ex = await Assert.ThrowsAsync<SettingsValidationException>(() => _service.UpdateAsync(
            new Dictionary<string, string?> { [SettingsService.UiSample] = "x", ["nope"] = "y" }));

        Assert.Contains("'nope'", ex.Message);
        Assert.Equal("", (await _service.GetAllAsync())[SettingsService.UiSample]); // all or nothing
    }

    [Fact]
    public async Task Update_accepts_1000_chars_and_rejects_1001()
    {
        await _service.UpdateAsync(new Dictionary<string, string?> { [SettingsService.UiSample] = new string('a', 1000) });

        var ex = await Assert.ThrowsAsync<SettingsValidationException>(() => _service.UpdateAsync(
            new Dictionary<string, string?> { [SettingsService.UiSample] = new string('a', 1001) }));
        Assert.Contains("too long", ex.Message);
    }

    [Fact]
    public async Task Update_rejects_null_value()
    {
        await Assert.ThrowsAsync<SettingsValidationException>(() => _service.UpdateAsync(
            new Dictionary<string, string?> { [SettingsService.UiSample] = null }));
    }

    [Fact]
    public async Task Update_saves_reader_settings_and_reads_them_back()
    {
        var all = await _service.UpdateAsync(new Dictionary<string, string?>
        {
            [SettingsService.ReaderFontSize] = "xlarge",
            [SettingsService.ReaderTheme] = "dark",
            [SettingsService.ReaderWidth] = "wide",
        });

        Assert.Equal("xlarge", all[SettingsService.ReaderFontSize]);
        Assert.Equal("dark", (await _service.GetAllAsync())[SettingsService.ReaderTheme]);
        Assert.Equal("wide", (await _service.GetAllAsync())[SettingsService.ReaderWidth]);
    }

    [Theory]
    [InlineData(SettingsService.ReaderFontSize, "huge")]
    [InlineData(SettingsService.ReaderFontSize, "")]
    [InlineData(SettingsService.ReaderTheme, "blue")]
    [InlineData(SettingsService.ReaderTheme, "Dark")] // case-sensitive: the API has one spelling
    [InlineData(SettingsService.ReaderWidth, "full")]
    public async Task Update_rejects_bad_reader_value(string key, string value)
    {
        var ex = await Assert.ThrowsAsync<SettingsValidationException>(() => _service.UpdateAsync(
            new Dictionary<string, string?> { [key] = value }));

        Assert.Contains($"'{key}'", ex.Message);
    }

    [Theory]
    [InlineData("20")]
    [InlineData("70")]
    public async Task Update_accepts_panel_width_at_range_edges(string value)
    {
        var all = await _service.UpdateAsync(new Dictionary<string, string?> { [SettingsService.ReaderPanelWidth] = value });

        Assert.Equal(value, all[SettingsService.ReaderPanelWidth]);
    }

    [Theory]
    [InlineData("19")]
    [InlineData("71")]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("40.5")]
    [InlineData("+40")]
    [InlineData(" 40")]
    public async Task Update_rejects_bad_panel_width(string value)
    {
        var ex = await Assert.ThrowsAsync<SettingsValidationException>(() => _service.UpdateAsync(
            new Dictionary<string, string?> { [SettingsService.ReaderPanelWidth] = value }));

        Assert.Contains($"'{SettingsService.ReaderPanelWidth}'", ex.Message);
    }

    [Fact]
    public async Task Update_with_valid_and_invalid_reader_values_saves_nothing()
    {
        await Assert.ThrowsAsync<SettingsValidationException>(() => _service.UpdateAsync(
            new Dictionary<string, string?>
            {
                [SettingsService.ReaderTheme] = "dark",
                [SettingsService.ReaderWidth] = "full",
                [SettingsService.UiSample] = "x",
            }));

        var all = await _service.GetAllAsync();
        Assert.Equal("light", all[SettingsService.ReaderTheme]);
        Assert.Equal("", all[SettingsService.UiSample]);
    }

    [Fact]
    public async Task Update_survives_a_concurrent_first_time_save_of_the_same_key()
    {
        // Simulates the race deterministically: just before our first save, another context inserts the same key.
        var racer = new RacingInsertInterceptor(_connection);
        await using var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).AddInterceptors(racer).Options);

        var all = await new SettingsService(db).UpdateAsync(
            new Dictionary<string, string?> { [SettingsService.UiSample] = "mine" });

        Assert.True(racer.Fired);
        Assert.Equal("mine", all[SettingsService.UiSample]);
    }

    private sealed class RacingInsertInterceptor(SqliteConnection connection) : SaveChangesInterceptor
    {
        public bool Fired { get; private set; }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken ct = default)
        {
            if (!Fired)
            {
                Fired = true;
                using var other = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
                other.Settings.Add(new Setting { Key = SettingsService.UiSample, Value = "other" });
                other.SaveChanges();
            }
            return ValueTask.FromResult(result);
        }
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }
}
