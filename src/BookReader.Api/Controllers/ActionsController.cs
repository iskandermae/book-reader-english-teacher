using BookReader.Api.Filters;
using BookReader.Core.Actions;
using Microsoft.AspNetCore.Mvc;

namespace BookReader.Api.Controllers;

[ApiController]
[Route("api/actions")]
[ServiceFilter<SettingsValidationExceptionFilter>]
public class ActionsController(ICustomActionService actions) : ControllerBase
{
    /// <summary>Lists the custom actions in saved order. A new database starts with one action, "Simplify (B2)".</summary>
    /// <param name="ct">Cancels the request.</param>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<CustomActionDto>>(StatusCodes.Status200OK)]
    public async Task<IReadOnlyList<CustomActionDto>> Get(CancellationToken ct) => await actions.ListAsync(ct);

    // Keep the "request" param doc last: the OpenAPI generator uses the last param doc as the request body description.
    /// <summary>Replaces the whole list of custom actions (all or nothing) and returns it with the assigned ids. Actions missing from the request are deleted; the request order is the saved order.</summary>
    /// <param name="ct">Cancels the request.</param>
    /// <param name="request">The new list: at most 20 actions; unique names (ignoring case); each prompt must contain {selection} and only known placeholders.</param>
    /// <response code="400">The list is invalid; the detail field explains what to fix. Nothing is saved.</response>
    [HttpPut]
    [ProducesResponseType<IReadOnlyList<CustomActionDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IReadOnlyList<CustomActionDto>> Put([FromBody] List<CustomActionInput> request, CancellationToken ct) =>
        await actions.ReplaceAsync(request, ct);
}
