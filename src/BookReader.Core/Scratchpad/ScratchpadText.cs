namespace BookReader.Core.Scratchpad;

/// <summary>The single scratchpad: free text the user pasted to work with. Always one row (<see cref="SingleId"/>).</summary>
public class ScratchpadText
{
    public const int SingleId = 1;

    public int Id { get; set; } = SingleId;
    public required string Text { get; set; }
}
