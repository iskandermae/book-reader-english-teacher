using Microsoft.Extensions.Logging;

namespace BookReader.Core.Audio;

/// <summary>The <c>audio</c> folder inside the data folder, where uploaded audio files are copied.</summary>
public class AudioStorage(string dataFolder, ILogger<AudioStorage> logger)
{
    // Extension -> content type. Only formats browsers play in an <audio> element.
    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".mp3"] = "audio/mpeg",
        [".m4a"] = "audio/mp4",
        [".m4b"] = "audio/mp4",
        [".aac"] = "audio/aac",
        [".ogg"] = "audio/ogg",
        [".oga"] = "audio/ogg",
        [".opus"] = "audio/ogg",
        [".wav"] = "audio/wav",
        [".flac"] = "audio/flac",
    };

    public static string SupportedExtensions => string.Join(", ", ContentTypes.Keys.Order());

    public string Folder { get; } = Path.Combine(dataFolder, "audio");

    /// <summary>Content type for a file name, or null when the extension is not supported.</summary>
    public static string? ContentTypeFor(string fileName) =>
        ContentTypes.GetValueOrDefault(Path.GetExtension(fileName));

    public string PathOf(string storedFileName) => Path.Combine(Folder, storedFileName);

    /// <summary>Copies the stream to a new file with a generated name and returns that name and the byte count.</summary>
    public async Task<(string StoredFileName, long Size)> SaveAsync(Stream content, string extension, CancellationToken ct)
    {
        Directory.CreateDirectory(Folder);
        var name = Guid.NewGuid().ToString("N") + extension.ToLowerInvariant();
        long size;
        try
        {
            await using var target = new FileStream(PathOf(name), FileMode.CreateNew, FileAccess.Write);
            await content.CopyToAsync(target, ct);
            size = target.Length;
        }
        catch
        {
            Delete([name]); // a failed or aborted copy must not leave a partial file behind
            throw;
        }
        return (name, size);
    }

    /// <summary>Deletes stored files; a missing file is fine, a locked one is skipped (best effort, the DB row is the truth).</summary>
    public void Delete(IEnumerable<string> storedFileNames)
    {
        foreach (var name in storedFileNames)
        {
            try { File.Delete(PathOf(name)); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning(ex, "Could not delete stored audio file {StoredFileName}", name);
            }
        }
    }
}
