using BookReader.Core.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BookReader.Core.Audio;

/// <summary>An audio file of a book with its chapter range (zero-based, inclusive).</summary>
public record AudioFileInfo(int Id, int BookId, string FileName, string ContentType, long SizeBytes, int FromChapter, int ToChapter);

/// <summary>A stored audio file ready to be streamed.</summary>
public record AudioContent(string Path, string ContentType, string FileName);

public interface IAudioService
{
    /// <summary>Lists a book's audio files by chapter range. Null when the book is unknown.</summary>
    Task<List<AudioFileInfo>?> ListAsync(int bookId, CancellationToken ct = default);

    /// <summary>
    /// Copies the file into the data folder and stores it. A null range end defaults to the first / last chapter.
    /// Null when the book is unknown.
    /// </summary>
    /// <exception cref="AudioException">Unsupported type, empty file, or an invalid or overlapping range. Nothing is stored.</exception>
    Task<AudioFileInfo?> AddAsync(int bookId, string fileName, Stream content, int? fromChapter, int? toChapter, CancellationToken ct = default);

    /// <summary>Changes the chapter range. Null when the book or file is unknown.</summary>
    /// <exception cref="AudioException">The range is invalid or overlaps another file of the book.</exception>
    Task<AudioFileInfo?> UpdateRangeAsync(int bookId, int audioId, int fromChapter, int toChapter, CancellationToken ct = default);

    /// <summary>Deletes the DB row and the copied file. Returns false when the book or file is unknown.</summary>
    Task<bool> DeleteAsync(int bookId, int audioId, CancellationToken ct = default);

    /// <summary>Gets the stored file for streaming. Null when unknown or the file is missing on disk.</summary>
    Task<AudioContent?> GetContentAsync(int bookId, int audioId, CancellationToken ct = default);
}

public class AudioService(AppDbContext db, AudioStorage storage, ILogger<AudioService> logger) : IAudioService
{
    public async Task<List<AudioFileInfo>?> ListAsync(int bookId, CancellationToken ct = default)
    {
        if (!await db.Books.AnyAsync(b => b.Id == bookId, ct))
            return null;
        var files = await db.AudioFiles.Where(a => a.BookId == bookId)
            .OrderBy(a => a.FromChapter).ThenBy(a => a.Id)
            .ToListAsync(ct);
        return files.Select(ToInfo).ToList();
    }

    public async Task<AudioFileInfo?> AddAsync(int bookId, string fileName, Stream content, int? fromChapter, int? toChapter, CancellationToken ct = default)
    {
        var chapterCount = await ChapterCountAsync(bookId, ct);
        if (chapterCount is null)
            return null;

        // All checks come before the (large) copy, so a bad request writes nothing.
        var contentType = AudioStorage.ContentTypeFor(fileName)
            ?? throw new AudioException($"Unsupported audio type. Supported: {AudioStorage.SupportedExtensions}.");
        var from = fromChapter ?? 0;
        var to = toChapter ?? chapterCount.Value - 1;
        await ValidateRangeAsync(bookId, null, from, to, chapterCount.Value, ct);

        var (storedName, size) = await storage.SaveAsync(content, Path.GetExtension(fileName), ct);
        try
        {
            if (size == 0)
                throw new AudioException("The audio file is empty.");

            var audio = new AudioFile
            {
                BookId = bookId, FileName = Path.GetFileName(fileName), StoredFileName = storedName,
                ContentType = contentType, SizeBytes = size, FromChapter = from, ToChapter = to, AddedAt = DateTime.UtcNow,
            };
            db.AudioFiles.Add(audio);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Audio file {AudioId} added to book {BookId}, chapters {From}-{To}, {Size} bytes", audio.Id, bookId, from, to, size);
            return ToInfo(audio);
        }
        catch
        {
            storage.Delete([storedName]); // never leave an orphan copy behind
            throw;
        }
    }

    public async Task<AudioFileInfo?> UpdateRangeAsync(int bookId, int audioId, int fromChapter, int toChapter, CancellationToken ct = default)
    {
        var audio = await db.AudioFiles.FirstOrDefaultAsync(a => a.Id == audioId && a.BookId == bookId, ct);
        if (audio is null)
            return null;

        await ValidateRangeAsync(bookId, audioId, fromChapter, toChapter, (await ChapterCountAsync(bookId, ct))!.Value, ct);
        audio.FromChapter = fromChapter;
        audio.ToChapter = toChapter;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Audio file {AudioId} of book {BookId} range changed to {From}-{To}", audioId, bookId, fromChapter, toChapter);
        return ToInfo(audio);
    }

    public async Task<bool> DeleteAsync(int bookId, int audioId, CancellationToken ct = default)
    {
        var audio = await db.AudioFiles.FirstOrDefaultAsync(a => a.Id == audioId && a.BookId == bookId, ct);
        if (audio is null)
            return false;

        db.AudioFiles.Remove(audio);
        await db.SaveChangesAsync(ct);
        storage.Delete([audio.StoredFileName]);
        logger.LogInformation("Audio file {AudioId} of book {BookId} deleted", audioId, bookId);
        return true;
    }

    public async Task<AudioContent?> GetContentAsync(int bookId, int audioId, CancellationToken ct = default)
    {
        var audio = await db.AudioFiles.AsNoTracking().FirstOrDefaultAsync(a => a.Id == audioId && a.BookId == bookId, ct);
        if (audio is null)
            return null;
        var path = storage.PathOf(audio.StoredFileName);
        if (File.Exists(path))
            return new AudioContent(path, audio.ContentType, audio.FileName);
        logger.LogWarning("Audio file {AudioId} of book {BookId} is in the database but its stored file {StoredFileName} is missing", audioId, bookId, audio.StoredFileName);
        return null;
    }

    private Task<int?> ChapterCountAsync(int bookId, CancellationToken ct) =>
        db.Books.Where(b => b.Id == bookId).Select(b => (int?)b.Chapters.Count).FirstOrDefaultAsync(ct);

    /// <summary>Checks 0 &lt;= from &lt;= to &lt; chapterCount and that no other file of the book (except <paramref name="ignoreAudioId"/>) shares a chapter.</summary>
    private async Task ValidateRangeAsync(int bookId, int? ignoreAudioId, int from, int to, int chapterCount, CancellationToken ct)
    {
        if (from < 0 || to >= chapterCount || from > to)
            throw new AudioException($"The chapter range is invalid. Use chapters 1 to {chapterCount}, with From not after To.");

        var clash = await db.AudioFiles
            .Where(a => a.BookId == bookId && a.Id != ignoreAudioId && a.FromChapter <= to && a.ToChapter >= from)
            .Select(a => a.FileName)
            .FirstOrDefaultAsync(ct);
        if (clash is not null)
            throw new AudioException($"The chapter range overlaps the audio file \"{clash}\". Change one of the ranges.");
    }

    private static AudioFileInfo ToInfo(AudioFile a) =>
        new(a.Id, a.BookId, a.FileName, a.ContentType, a.SizeBytes, a.FromChapter, a.ToChapter);
}
