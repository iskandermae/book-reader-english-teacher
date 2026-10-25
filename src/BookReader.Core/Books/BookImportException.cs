namespace BookReader.Core.Books;

/// <summary>Thrown when an uploaded book cannot be imported (bad encoding, empty file, invalid chapter regex). The message is safe to show to the user.</summary>
public class BookImportException(string message) : Exception(message);
