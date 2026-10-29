namespace BookReader.Core.Audio;

/// <summary>Thrown when an audio upload or range edit is invalid (type, empty file, bad or overlapping range). The message is safe to show to the user.</summary>
public class AudioException(string message) : Exception(message);
