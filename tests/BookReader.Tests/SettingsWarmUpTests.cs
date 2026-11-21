using BookReader.Api;
using BookReader.Api.Controllers;
using BookReader.Core.Settings;
using Microsoft.Extensions.Logging.Abstractions;

namespace BookReader.Tests;

public sealed class SettingsWarmUpTests
{
    private sealed class CountingWarmUp() : LlmWarmUp(null!, NullLogger<LlmWarmUp>.Instance)
    {
        public int Starts { get; private set; }
        public override void Start() => Starts++;
    }

    private sealed class AcceptAllSettings : ISettingsService
    {
        public Task<IReadOnlyDictionary<string, string>> GetAllAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<string> GetAsync(string key, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<IReadOnlyDictionary<string, string>> UpdateAsync(IReadOnlyDictionary<string, string?> values, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyDictionary<string, string>>(new Dictionary<string, string>());
    }

    [Theory]
    [InlineData(SettingsService.OllamaModel, 1)]
    [InlineData(SettingsService.OllamaUrl, 1)]
    [InlineData(SettingsService.LanguageNative, 0)]
    public async Task Saving_settings_warms_up_only_for_model_or_url(string key, int expectedStarts)
    {
        var warmUp = new CountingWarmUp();

        await new SettingsController(new AcceptAllSettings(), warmUp).Put(new Dictionary<string, string?> { [key] = "x" }, default);

        Assert.Equal(expectedStarts, warmUp.Starts);
    }
}
