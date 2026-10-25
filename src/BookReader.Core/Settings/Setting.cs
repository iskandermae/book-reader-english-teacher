namespace BookReader.Core.Settings;

/// <summary>One stored setting (a row of the key/value Settings table). Only explicitly saved values are stored.</summary>
public class Setting
{
    public required string Key { get; set; }
    public required string Value { get; set; }
}
