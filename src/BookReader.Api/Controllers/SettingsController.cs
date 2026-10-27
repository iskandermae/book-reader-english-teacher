using BookReader.Api.Filters;
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

    /// <summary>Updates one or more settings. The request is all or nothing; returns all settings after the update.</summary>
    /// <param name="ct">Cancels the request.</param>
    /// <param name="values">Key/value map. Only known keys are accepted; values may be at most 1000 characters. reader.fontSize: small|medium|large|xlarge; reader.theme: light|dark; reader.width: narrow|medium|wide; reader.panelWidth: whole number 20-70 (percent, default 40).</param>
    /// <response code="400">Unknown key or invalid value; the detail field explains what to fix.</response>
    [HttpPut]
    [ProducesResponseType<Dictionary<string, string>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IReadOnlyDictionary<string, string>> Put(
        [FromBody] Dictionary<string, string?> values, CancellationToken ct) =>
        await settings.UpdateAsync(values, ct);
}
