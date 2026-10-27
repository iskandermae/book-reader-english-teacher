using BookReader.Core.Data;
using Microsoft.EntityFrameworkCore;

namespace BookReader.Core.Scratchpad;

public interface IScratchpadService
{
    /// <summary>The saved text; empty when never saved.</summary>
    Task<string> GetAsync(CancellationToken ct = default);

    /// <summary>Replaces the saved text. Returns false (and saves nothing) when it is longer than <see cref="ScratchpadService.MaxLength"/>.</summary>
    Task<bool> SaveAsync(string text, CancellationToken ct = default);
}

public class ScratchpadService(AppDbContext db) : IScratchpadService
{
    public const int MaxLength = 200_000;

    public async Task<string> GetAsync(CancellationToken ct = default) =>
        await db.Scratchpad.AsNoTracking().Where(s => s.Id == ScratchpadText.SingleId)
            .Select(s => s.Text).FirstOrDefaultAsync(ct) ?? "";

    public async Task<bool> SaveAsync(string text, CancellationToken ct = default)
    {
        if (text.Length > MaxLength)
            return false;

        var row = await db.Scratchpad.FindAsync([ScratchpadText.SingleId], ct);
        if (row is null)
            db.Scratchpad.Add(new ScratchpadText { Text = text });
        else
            row.Text = text;
        await db.SaveChangesAsync(ct);
        return true;
    }
}
