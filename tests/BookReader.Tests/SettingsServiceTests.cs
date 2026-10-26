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

        Assert.Equal(6, all.Count);
        Assert.Equal("medium", all[SettingsService.ReaderFontSize]);
        Assert.Equal("light", all[SettingsService.ReaderTheme]);
        Assert.Equal("medium", all[SettingsService.ReaderWidth]);
        Assert.Equal("", all[SettingsService.OllamaModel]); // never hardcoded (D12)
        Assert.Equal("", all[SettingsService.UiSample]);
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
