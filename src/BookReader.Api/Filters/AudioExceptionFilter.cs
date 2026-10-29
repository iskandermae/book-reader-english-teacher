using BookReader.Core.Audio;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace BookReader.Api.Filters;

/// <summary>Maps <see cref="AudioException"/> to a 400 ProblemDetails, so actions need no try/catch.</summary>
public class AudioExceptionFilter(ProblemDetailsFactory problemDetails, ILogger<AudioExceptionFilter> logger) : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not AudioException ex)
            return;

        logger.LogInformation("Audio request rejected");
        var problem = problemDetails.CreateProblemDetails(
            context.HttpContext, StatusCodes.Status400BadRequest, title: "Audio request is invalid", detail: ex.Message);
        context.Result = new ObjectResult(problem) { StatusCode = problem.Status };
        context.ExceptionHandled = true;
    }
}
