using BookReader.Core.Books;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace BookReader.Api.Filters;

/// <summary>Maps <see cref="BookImportException"/> to a 400 ProblemDetails, so actions need no try/catch.</summary>
public class BookImportExceptionFilter(ProblemDetailsFactory problemDetails) : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not BookImportException ex)
            return;

        var problem = problemDetails.CreateProblemDetails(
            context.HttpContext, StatusCodes.Status400BadRequest, title: "Book cannot be imported", detail: ex.Message);
        context.Result = new ObjectResult(problem) { StatusCode = problem.Status };
        context.ExceptionHandled = true;
    }
}
