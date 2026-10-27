using BookReader.Core.Scratchpad;
using Microsoft.AspNetCore.Mvc;

namespace BookReader.Api.Controllers;

/// <summary>The scratchpad text.</summary>
/// <param name="Text">The text; empty when nothing was saved. At most 200,000 characters.</param>
public record ScratchpadDto(string Text);

[ApiController]
[Route("api/scratchpad")]
public class ScratchpadController(IScratchpadService scratchpad) : ControllerBase
{
    /// <summary>Gets the scratchpad text (one per app); empty when never saved.</summary>
    /// <param name="ct">Cancels the request.</param>
    /// <response code="200">The saved text.</response>
    [HttpGet]
    [ProducesResponseType<ScratchpadDto>(StatusCodes.Status200OK)]
    public async Task<ScratchpadDto> Get(CancellationToken ct) => new(await scratchpad.GetAsync(ct));

    // Keep the "request" param doc last: the OpenAPI generator uses the last param doc as the request body description.
    /// <summary>Replaces the scratchpad text.</summary>
    /// <param name="ct">Cancels the request.</param>
    /// <param name="request">The new text (may be empty to clear it).</param>
    /// <response code="200">The text was saved.</response>
    /// <response code="400">The text is longer than 200,000 characters. Nothing is saved.</response>
    [HttpPut]
    [ProducesResponseType<ScratchpadDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ScratchpadDto>> Put(ScratchpadDto request, CancellationToken ct) =>
        await scratchpad.SaveAsync(request.Text, ct)
            ? request
            : Problem(
                detail: $"The text is too long ({request.Text.Length} characters, maximum is {ScratchpadService.MaxLength}).",
                statusCode: StatusCodes.Status400BadRequest);
}
