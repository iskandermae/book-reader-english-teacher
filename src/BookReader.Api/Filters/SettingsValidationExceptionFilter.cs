using BookReader.Core.Settings;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace BookReader.Api.Filters;

/// <summary>Maps <see cref="SettingsValidationException"/> to a 400 ProblemDetails, so actions need no try/catch.</summary>
public class SettingsValidationExceptionFilter(ProblemDetailsFactory problemDetails) : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not SettingsValidationException ex)
            return;

        var problem = problemDetails.CreateProblemDetails(
            context.HttpContext, StatusCodes.Status400BadRequest, title: "Invalid settings", detail: ex.Message);
        context.Result = new ObjectResult(problem) { StatusCode = problem.Status };
        context.ExceptionHandled = true;
    }
}
