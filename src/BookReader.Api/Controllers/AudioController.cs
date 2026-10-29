using BookReader.Api.Filters;
using BookReader.Core.Audio;
using Microsoft.AspNetCore.Mvc;

namespace BookReader.Api.Controllers;

/// <summary>Multipart form of the audio upload: one file and an optional chapter range.</summary>
public class AddAudioRequest
{
    /// <summary>The audio file (mp3, m4a, m4b, aac, ogg, oga, opus, wav, flac).</summary>
    [FromForm(Name = "file")]
    public IFormFile? File { get; init; } // not "required": a missing file gets the service's clear 400 message

    /// <summary>First chapter covered (zero-based chapter index). Default: 0, the first chapter.</summary>
    public int? FromChapter { get; init; }

    /// <summary>Last chapter covered (zero-based chapter index, inclusive). Default: the last chapter of the book.</summary>
    public int? ToChapter { get; init; }
}

/// <summary>An audio file of a book and the chapters it covers.</summary>
/// <param name="Id">Audio file id.</param>
/// <param name="BookId">Book id.</param>
/// <param name="FileName">The uploaded file name, for display.</param>
/// <param name="ContentType">Media type, e.g. audio/mpeg.</param>
/// <param name="SizeBytes">Size of the stored file in bytes.</param>
/// <param name="FromChapter">First chapter covered (zero-based chapter index).</param>
/// <param name="ToChapter">Last chapter covered (zero-based chapter index, inclusive).</param>
public record AudioFileResponse(int Id, int BookId, string FileName, string ContentType, long SizeBytes, int FromChapter, int ToChapter);

/// <summary>A new chapter range for an audio file.</summary>
/// <param name="FromChapter">First chapter covered (zero-based chapter index).</param>
/// <param name="ToChapter">Last chapter covered (zero-based chapter index, inclusive).</param>
public record AudioRangeRequest(int FromChapter, int ToChapter);

[ApiController]
[Route("api/books/{bookId:int}/audio")]
[ServiceFilter<AudioExceptionFilter>]
public class AudioController(IAudioService audio) : ControllerBase
{
    /// <summary>Largest accepted audio upload: 1 GB (long audiobooks as one file).</summary>
    private const long MaxUploadBytes = 1024L * 1024 * 1024;

    private static AudioFileResponse ToResponse(AudioFileInfo a) =>
        new(a.Id, a.BookId, a.FileName, a.ContentType, a.SizeBytes, a.FromChapter, a.ToChapter);

    /// <summary>Lists the audio files of a book, ordered by first chapter. Empty list when there are none.</summary>
    /// <param name="bookId">Book id.</param>
    /// <param name="ct">Cancels the request.</param>
    /// <response code="200">The audio files.</response>
    /// <response code="404">No book with this id.</response>
    [HttpGet]
    [ProducesResponseType<List<AudioFileResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<List<AudioFileResponse>>> List(int bookId, CancellationToken ct) =>
        await audio.ListAsync(bookId, ct) is { } files ? files.Select(ToResponse).ToList() : NotFound();

    // Keep the "request" param doc last: the OpenAPI generator uses the last param doc as the request body description.
    /// <summary>Attaches an audio file to a book: copies it into the data folder and stores its chapter range (default: the whole book). Upload limit: 1 GB per file.</summary>
    /// <param name="bookId">Book id.</param>
    /// <param name="ct">Cancels the request.</param>
    /// <param name="request">The audio file and an optional chapter range.</param>
    /// <response code="200">The file was attached.</response>
    /// <response code="400">No file, unsupported type, empty file, a range outside the book, From after To, or a range that overlaps another audio file of the book. Nothing is saved.</response>
    /// <response code="404">No book with this id.</response>
    [HttpPost]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    [ProducesResponseType<AudioFileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AudioFileResponse>> Add(int bookId, CancellationToken ct, [FromForm] AddAudioRequest request)
    {
        if (request.File is null)
            throw new AudioException("No file was uploaded. Choose an audio file.");

        await using var content = request.File.OpenReadStream();
        var added = await audio.AddAsync(bookId, request.File.FileName, content, request.FromChapter, request.ToChapter, ct);
        return added is null ? NotFound() : ToResponse(added);
    }

    // Keep the "range" param doc last: the OpenAPI generator uses the last param doc as the request body description.
    /// <summary>Changes the chapter range of an audio file.</summary>
    /// <param name="bookId">Book id.</param>
    /// <param name="audioId">Audio file id.</param>
    /// <param name="ct">Cancels the request.</param>
    /// <param name="range">The new first and last chapter.</param>
    /// <response code="200">The range was saved.</response>
    /// <response code="400">The range is outside the book, From is after To, or it overlaps another audio file of the book.</response>
    /// <response code="404">No book or audio file with this id.</response>
    [HttpPut("{audioId:int}")]
    [ProducesResponseType<AudioFileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AudioFileResponse>> UpdateRange(int bookId, int audioId, CancellationToken ct, AudioRangeRequest range) =>
        await audio.UpdateRangeAsync(bookId, audioId, range.FromChapter, range.ToChapter, ct) is { } updated
            ? ToResponse(updated)
            : NotFound();

    /// <summary>Removes an audio file: deletes its database row and the copy in the data folder.</summary>
    /// <param name="bookId">Book id.</param>
    /// <param name="audioId">Audio file id.</param>
    /// <param name="ct">Cancels the request.</param>
    /// <response code="204">The audio file was removed.</response>
    /// <response code="404">No book or audio file with this id.</response>
    [HttpDelete("{audioId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int bookId, int audioId, CancellationToken ct) =>
        await audio.DeleteAsync(bookId, audioId, ct) ? NoContent() : NotFound();

    /// <summary>Streams the audio file. Supports HTTP range requests (206 Partial Content), so seeking works; use it as the <c>src</c> of an audio element.</summary>
    /// <param name="bookId">Book id.</param>
    /// <param name="audioId">Audio file id.</param>
    /// <param name="ct">Cancels the request.</param>
    /// <response code="200">The whole file (no Range header).</response>
    /// <response code="206">The requested byte range.</response>
    /// <response code="404">No book or audio file with this id, or the stored file is missing.</response>
    /// <response code="416">The requested range is not satisfiable.</response>
    [HttpGet("{audioId:int}/content")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status206PartialContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status416RangeNotSatisfiable)]
    public async Task<IActionResult> Content(int bookId, int audioId, CancellationToken ct) =>
        await audio.GetContentAsync(bookId, audioId, ct) is { } file
            ? PhysicalFile(file.Path, file.ContentType, enableRangeProcessing: true)
            : NotFound();
}
