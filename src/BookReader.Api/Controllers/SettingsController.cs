using BookReader.Api.Filters;
using BookReader.Core.Llm;
using BookReader.Core.Settings;
using Microsoft.AspNetCore.Mvc;

namespace BookReader.Api.Controllers;

[ApiController]
[Route("api/settings")]
[ServiceFilter<SettingsValidationExceptionFilter>]
public class SettingsController(ISettingsService settings) : ControllerBase
{
    /// <summary>Returns all settings as a key/value map. Settings never saved have their default value.</summary>
    [HttpGet]
    [ProducesResponseType<Dictionary<string, string>>(StatusCodes.Status200OK)]
    public async Task<IReadOnlyDictionary<string, string>> Get(CancellationToken ct) =>
        await settings.GetAllAsync(ct);

    /// <summary>Returns the default value of every known setting (same shape as the settings list), ignoring saved values. Used to reset a setting, for example a prompt template.</summary>
    [HttpGet("defaults")]
    [ProducesResponseType<Dictionary<string, string>>(StatusCodes.Status200OK)]
    public IReadOnlyDictionary<string, string> GetDefaults() => SettingsService.GetDefaults();

    /// <summary>Returns the placeholders a prompt template may use ({name} in the template), with a description each. Single source for the settings UI.</summary>
    [HttpGet("placeholders")]
    [ProducesResponseType<IReadOnlyList<PlaceholderInfo>>(StatusCodes.Status200OK)]
    public IReadOnlyList<PlaceholderInfo> GetPlaceholders() => PromptTemplate.Placeholders;

    /// <summary>Updates one or more settings. The request is all or nothing; returns all settings after the update.</summary>
    /// <param name="ct">Cancels the request.</param>
    /// <param name="values">Key/value map. Only known keys are accepted; values may be at most 1000 characters (4000 for prompt.* keys). language.from: language of the book, default English. language.level: English level A1|A2|B1|B2|C1|C2, default B2. ollama.url: absolute http or https address. prompt.translate and prompt.explain: prompt templates (default = built-in prompt); allowed placeholders: {selection} (required), {sentence}, {paragraph}, {native_language}, {target_language}, {from_language}, {english_level}; an unknown placeholder or a missing {selection} is rejected. reader.fontSize: small|medium|large|xlarge; reader.theme: light|dark; reader.width: narrow|medium|wide; reader.panelWidth: whole number 20-70 (percent, default 40). player.speed: 0.75|1|1.25|1.5, default 1.</param>
    /// <response code="400">Unknown key or invalid value; the detail field explains what to fix.</response>
    [HttpPut]
    [ProducesResponseType<Dictionary<string, string>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IReadOnlyDictionary<string, string>> Put(
        [FromBody] Dictionary<string, string?> values, CancellationToken ct) =>
        await settings.UpdateAsync(values, ct);
}
