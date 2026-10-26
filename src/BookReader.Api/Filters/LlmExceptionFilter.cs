using BookReader.Core.Llm;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace BookReader.Api.Filters;

/// <summary>Maps LLM exceptions to ProblemDetails: setup problems (no model, unknown model) -> 400, server problems -> 503. The message is the user hint.</summary>
public class LlmExceptionFilter(ProblemDetailsFactory problemDetails) : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not LlmException ex)
            return;

        var (status, title) = ex is LlmUnavailableException
            ? (StatusCodes.Status503ServiceUnavailable, "AI is not available")
            : (StatusCodes.Status400BadRequest, "AI is not set up");

        var problem = problemDetails.CreateProblemDetails(context.HttpContext, status, title, detail: ex.Message);
        context.Result = new ObjectResult(problem) { StatusCode = status };
        context.ExceptionHandled = true;
    }
}
