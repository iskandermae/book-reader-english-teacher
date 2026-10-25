using BookReader.Api.Filters;
using BookReader.Core.Books;
using Microsoft.AspNetCore.Mvc;

namespace BookReader.Api.Controllers;

/// <summary>Multipart form of the import request: a .txt book file and an optional title.</summary>
public class ImportBookRequest
{
    public required IFormFile File { get; init; }

    public string? Title { get; init; }
}

/// <summary>The imported book.</summary>
/// <param name="Id">Book id.</param>
/// <param name="Title">Book title.</param>
/// <param name="ChapterCount">Number of chapters found.</param>
public record ImportBookResponse(int Id, string Title, int ChapterCount);

[ApiController]
[Route("api/books")]
[ServiceFilter<BookImportExceptionFilter>]
public class BooksController(IBookImportService importService) : ControllerBase
{
    // Keep the "request" param doc last: the OpenAPI generator uses the last param doc as the request body description.
    /// <summary>Imports a .txt book: splits it into chapters and paragraphs and stores it.</summary>
    /// <param name="ct">Cancels the request.</param>
    /// <param name="request">The .txt file and an optional title.</param>
    /// <response code="200">The book was imported.</response>
    /// <response code="400">The file is not .txt, is empty, is not UTF-8, or the chapter pattern setting is invalid; the detail field explains what to fix.</response>
    [HttpPost]
    [Consumes("multipart/form-data")]
    [ProducesResponseType<ImportBookResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ImportBookResponse> Import([FromForm] ImportBookRequest request, CancellationToken ct)
    {
        await using var stream = request.File.OpenReadStream();
        var result = await importService.ImportAsync(stream, request.File.FileName, request.Title, ct);
        return new ImportBookResponse(result.BookId, result.Title, result.ChapterCount);
    }
}
