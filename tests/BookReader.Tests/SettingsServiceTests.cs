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

        Assert.Equal(3, all.Count);
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
