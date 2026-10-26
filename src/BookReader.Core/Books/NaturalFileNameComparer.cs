namespace BookReader.Core.Books;

/// <summary>
/// Orders file names the way people expect: digit runs compare by number (<c>ch2</c> before <c>ch10</c>), text ignores case.
/// Own implementation instead of <c>CompareOptions.NumericOrdering</c> so the order does not depend on ICU/culture data.
/// The frontend lists files with the same rule.
/// </summary>
public sealed class NaturalFileNameComparer : IComparer<string>
{
    public static readonly NaturalFileNameComparer Instance = new();

    public int Compare(string? x, string? y)
    {
        if (ReferenceEquals(x, y)) return 0;
        if (x is null) return -1;
        if (y is null) return 1;

        int i = 0, j = 0;
        while (i < x.Length && j < y.Length)
        {
            if (char.IsAsciiDigit(x[i]) && char.IsAsciiDigit(y[j]))
            {
                var (numX, nextI) = DigitRun(x, i);
                var (numY, nextJ) = DigitRun(y, j);
                // Without leading zeros a longer run is a bigger number; equal lengths compare digit by digit.
                var byNumber = numX.Length != numY.Length
                    ? numX.Length.CompareTo(numY.Length)
                    : string.CompareOrdinal(numX, numY);
                if (byNumber != 0) return byNumber;
                i = nextI;
                j = nextJ;
            }
            else
            {
                var byChar = char.ToUpperInvariant(x[i]).CompareTo(char.ToUpperInvariant(y[j]));
                if (byChar != 0) return byChar;
                i++;
                j++;
            }
        }
        // The shorter name (a prefix of the other) comes first.
        return (x.Length - i).CompareTo(y.Length - j);
    }

    /// <summary>Reads the digit run at <paramref name="start"/>; returns it without leading zeros and the index after it.</summary>
    private static (string Digits, int Next) DigitRun(string s, int start)
    {
        var end = start;
        while (end < s.Length && char.IsAsciiDigit(s[end])) end++;
        return (s[start..end].TrimStart('0'), end);
    }
}
