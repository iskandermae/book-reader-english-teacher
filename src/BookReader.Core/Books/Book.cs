namespace BookReader.Core.Books;

/// <summary>An imported book. Chapters (and their paragraphs) are deleted together with it.</summary>
public class Book
{
    public int Id { get; set; }
    public required string Title { get; set; }
    public DateTime ImportedAt { get; set; }
    /// <summary>When the book was last opened in the reader; null until it is opened (set when a reading position is saved).</summary>
    public DateTime? LastOpenedAt { get; set; }
    /// <summary>Saved reading position: zero-based chapter index. Null (with the paragraph) until a position is saved.</summary>
    public int? PositionChapterIndex { get; set; }
    /// <summary>Saved reading position: zero-based paragraph index inside that chapter.</summary>
    public int? PositionParagraphIndex { get; set; }
    public List<Chapter> Chapters { get; set; } = [];
}

public class Chapter
{
    public int Id { get; set; }
    public int BookId { get; set; }
    /// <summary>Zero-based position inside the book.</summary>
    public int Index { get; set; }
    public required string Title { get; set; }
    public List<Paragraph> Paragraphs { get; set; } = [];
}

public class Paragraph
{
    public int Id { get; set; }
    public int ChapterId { get; set; }
    /// <summary>Zero-based position inside the chapter.</summary>
    public int Index { get; set; }
    public required string Text { get; set; }
}
