namespace BookReader.Core.Books;

/// <summary>An imported book. Chapters (and their paragraphs) are deleted together with it.</summary>
public class Book
{
    public int Id { get; set; }
    public required string Title { get; set; }
    public DateTime ImportedAt { get; set; }
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
