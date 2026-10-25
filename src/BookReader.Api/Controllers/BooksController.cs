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

/// <summary>A book in the library list.</summary>
/// <param name="Id">Book id.</param>
/// <param name="Title">Book title.</param>
/// <param name="ChapterCount">Number of chapters.</param>
/// <param name="ImportedAt">When the book was imported (UTC).</param>
/// <param name="LastOpenedAt">When the book was last opened (UTC); null if never opened.</param>
public record BookSummaryResponse(int Id, string Title, int ChapterCount, DateTime ImportedAt, DateTime? LastOpenedAt);

[ApiController]
[Route("api/books")]
[ServiceFilter<BookImportExceptionFilter>]
public class BooksController(IBookImportService importService, IBookLibraryService library) : ControllerBase
{
    /// <summary>Lists all books, last opened first, then most recently imported. Empty list when there are none.</summary>
    /// <param name="ct">Cancels the request.</param>
    /// <response code="200">The books, without chapter or paragraph text.</response>
    [HttpGet]
    [ProducesResponseType<List<BookSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<List<BookSummaryResponse>> List(CancellationToken ct) =>
        (await library.ListAsync(ct))
            .Select(b => new BookSummaryResponse(b.Id, b.Title, b.ChapterCount, b.ImportedAt, b.LastOpenedAt))
            .ToList();

    /// <summary>Deletes a book together with its chapters and paragraphs.</summary>
    /// <param name="id">Book id.</param>
    /// <param name="ct">Cancels the request.</param>
    /// <response code="204">The book was deleted.</response>
    /// <response code="404">No book with this id.</response>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) =>
        await library.DeleteAsync(id, ct) ? NoContent() : NotFound();

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
