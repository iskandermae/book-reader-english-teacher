namespace BookReader.Core.Audio;

/// <summary>An audio file attached to a book. It covers the chapters FromChapter..ToChapter (zero-based, inclusive).</summary>
public class AudioFile
{
    public int Id { get; set; }
    public int BookId { get; set; }
    /// <summary>Name the user uploaded, shown in the UI. Never used as a path.</summary>
    public required string FileName { get; set; }
    /// <summary>Generated name of the copy in the data folder (no user text, so no path tricks or clashes).</summary>
    public required string StoredFileName { get; set; }
    public required string ContentType { get; set; }
    public long SizeBytes { get; set; }
    public int FromChapter { get; set; }
    public int ToChapter { get; set; }
    public DateTime AddedAt { get; set; }
    /// <summary>Where the listener stopped, in seconds. One position per file; independent of the chapter range.</summary>
    public double PositionSeconds { get; set; }
}
