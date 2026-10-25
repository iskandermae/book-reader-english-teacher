namespace BookReader.Core.Data;

/// <summary>Location of the runtime <c>data</c> folder (database, settings, generated files).</summary>
public static class DataFolder
{
    public const string DatabaseFileName = "bookreader.db";

    /// <summary>Resolves the data folder: the configured override (used by tests) or <c>data</c> beside the executable.</summary>
    public static string Resolve(string? configuredPath) =>
        string.IsNullOrWhiteSpace(configuredPath)
            ? Path.Combine(AppContext.BaseDirectory, "data")
            : Path.GetFullPath(configuredPath);

    public static string DatabasePath(string dataFolder) => Path.Combine(dataFolder, DatabaseFileName);
}
