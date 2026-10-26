using BookReader.Api.Filters;
using BookReader.Core.Books;
using Microsoft.AspNetCore.Mvc;

namespace BookReader.Api.Controllers;

/// <summary>Multipart form of the import request: one or more .txt files of a book and an optional title.</summary>
public class ImportBookRequest
{
    /// <summary>The .txt files, sent as repeated <c>file</c> parts. They are merged in natural file-name order, not upload order.</summary>
    [FromForm(Name = "file")]
    public List<IFormFile> Files { get; init; } = []; // not "required": zero files gets the service's clear 400 message

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

/// <summary>A chapter in a book's chapter list.</summary>
/// <param name="Index">Zero-based chapter index; use it to fetch the chapter text.</param>
/// <param name="Title">Chapter title.</param>
/// <param name="ParagraphCount">Number of paragraphs in the chapter.</param>
public record ChapterSummaryResponse(int Index, string Title, int ParagraphCount);

/// <summary>A book's chapter list.</summary>
/// <param name="BookId">Book id.</param>
/// <param name="Title">Book title.</param>
/// <param name="Chapters">Chapters ordered by index.</param>
public record BookChaptersResponse(int BookId, string Title, List<ChapterSummaryResponse> Chapters);

/// <summary>One chapter with its text.</summary>
/// <param name="BookId">Book id.</param>
/// <param name="Index">Zero-based chapter index.</param>
/// <param name="Title">Chapter title.</param>
/// <param name="Paragraphs">Paragraph texts in reading order; the array position is the paragraph index.</param>
public record ChapterResponse(int BookId, int Index, string Title, List<string> Paragraphs);

/// <summary>Where the reader stopped in a book. Both values are zero-based.</summary>
/// <param name="ChapterIndex">Chapter index.</param>
/// <param name="ParagraphIndex">Paragraph index inside the chapter (array position in the chapter response).</param>
public record ReadingPositionDto(int ChapterIndex, int ParagraphIndex);

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

    /// <summary>Lists the chapters of a book in reading order, without paragraph text.</summary>
    /// <param name="id">Book id.</param>
    /// <param name="ct">Cancels the request.</param>
    /// <response code="200">The book title and its chapters.</response>
    /// <response code="404">No book with this id.</response>
    [HttpGet("{id:int}/chapters")]
    [ProducesResponseType<BookChaptersResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BookChaptersResponse>> GetChapters(int id, CancellationToken ct)
    {
        var book = await library.GetChaptersAsync(id, ct);
        return book is null
            ? NotFound()
            : new BookChaptersResponse(book.BookId, book.Title,
                book.Chapters.Select(c => new ChapterSummaryResponse(c.Index, c.Title, c.ParagraphCount)).ToList());
    }

    /// <summary>Gets one whole chapter: its title and all paragraphs in order.</summary>
    /// <param name="id">Book id.</param>
    /// <param name="index">Zero-based chapter index.</param>
    /// <param name="ct">Cancels the request.</param>
    /// <response code="200">The chapter text.</response>
    /// <response code="404">No book with this id, or no chapter with this index.</response>
    [HttpGet("{id:int}/chapters/{index:int}")]
    [ProducesResponseType<ChapterResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ChapterResponse>> GetChapter(int id, int index, CancellationToken ct)
    {
        var chapter = await library.GetChapterAsync(id, index, ct);
        return chapter is null
            ? NotFound()
            : new ChapterResponse(chapter.BookId, chapter.Index, chapter.Title, chapter.Paragraphs);
    }

    /// <summary>Gets where the reader stopped in a book; chapter 0, paragraph 0 when nothing is saved. Does not change the last-opened time.</summary>
    /// <param name="id">Book id.</param>
    /// <param name="ct">Cancels the request.</param>
    /// <response code="200">The saved position.</response>
    /// <response code="404">No book with this id.</response>
    [HttpGet("{id:int}/position")]
    [ProducesResponseType<ReadingPositionDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReadingPositionDto>> GetPosition(int id, CancellationToken ct)
    {
        var position = await library.GetPositionAsync(id, ct);
        return position is null ? NotFound() : new ReadingPositionDto(position.ChapterIndex, position.ParagraphIndex);
    }

    // Keep the "position" param doc last: the OpenAPI generator uses the last param doc as the request body description.
    /// <summary>Saves where the reader stopped and sets the book's last-opened time to now.</summary>
    /// <param name="id">Book id.</param>
    /// <param name="ct">Cancels the request.</param>
    /// <param name="position">Chapter and paragraph index.</param>
    /// <response code="204">The position was saved.</response>
    /// <response code="400">The chapter does not exist, or the paragraph index is negative or not below the chapter's paragraph count.</response>
    /// <response code="404">No book with this id.</response>
    [HttpPut("{id:int}/position")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SavePosition(int id, ReadingPositionDto position, CancellationToken ct) =>
        await library.SavePositionAsync(id, new ReadingPosition(position.ChapterIndex, position.ParagraphIndex), ct) switch
        {
            SavePositionResult.Saved => NoContent(),
            SavePositionResult.BookNotFound => NotFound(),
            SavePositionResult.ChapterNotFound => Problem(detail: "The chapter does not exist.", statusCode: StatusCodes.Status400BadRequest),
            _ => Problem(detail: "The paragraph index is out of range for this chapter.", statusCode: StatusCodes.Status400BadRequest),
        };

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
    /// <summary>Imports a book from one or more .txt files (merged in natural file-name order): splits it into chapters and paragraphs and stores it.</summary>
    /// <param name="ct">Cancels the request.</param>
    /// <param name="request">The .txt files and an optional title (default: first file name without extension).</param>
    /// <response code="200">The book was imported.</response>
    /// <response code="400">No files, or a file is not .txt, is empty or is not UTF-8 (the detail names the file), or the chapter pattern setting is invalid. Nothing is saved.</response>
    [HttpPost]
    [Consumes("multipart/form-data")]
    [ProducesResponseType<ImportBookResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ImportBookResponse> Import([FromForm] ImportBookRequest request, CancellationToken ct)
    {
        var files = request.Files.Select(f => new BookImportFile(f.FileName, f.OpenReadStream())).ToList();
        try
        {
            var result = await importService.ImportAsync(files, request.Title, ct);
            return new ImportBookResponse(result.BookId, result.Title, result.ChapterCount);
        }
        finally
        {
            foreach (var file in files)
                await file.Content.DisposeAsync();
        }
    }
}
