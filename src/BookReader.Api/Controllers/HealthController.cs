using Microsoft.AspNetCore.Mvc;

namespace BookReader.Api.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    /// <summary>Reports that the API is running.</summary>
    [HttpGet]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status200OK)]
    public HealthResponse Get() => new("ok");
}

/// <summary>Response of the health endpoint.</summary>
/// <param name="Status">Always "ok" when the API is up.</param>
public record HealthResponse(string Status);
