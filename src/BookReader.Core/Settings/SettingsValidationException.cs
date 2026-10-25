namespace BookReader.Core.Settings;

/// <summary>Thrown when a settings update contains unknown keys or invalid values. The message is safe to show to the user.</summary>
public class SettingsValidationException(string message) : Exception(message);
