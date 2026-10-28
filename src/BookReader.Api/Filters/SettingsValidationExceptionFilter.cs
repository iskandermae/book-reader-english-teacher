using BookReader.Core.Actions;
using BookReader.Core.Settings;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace BookReader.Api.Filters;

/// <summary>Maps <see cref="SettingsValidationException"/> and <see cref="ActionsValidationException"/> to a 400 ProblemDetails, so actions need no try/catch.</summary>
public class SettingsValidationExceptionFilter(ProblemDetailsFactory problemDetails) : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        var title = context.Exception switch
        {
            SettingsValidationException => "Invalid settings",
            ActionsValidationException => "Invalid actions",
            _ => null,
        };
        if (title is null)
            return;

        var problem = problemDetails.CreateProblemDetails(
            context.HttpContext, StatusCodes.Status400BadRequest, title: title, detail: context.Exception.Message);
        context.Result = new ObjectResult(problem) { StatusCode = problem.Status };
        context.ExceptionHandled = true;
    }
}
