using BookReader.Core.Settings;
using Microsoft.EntityFrameworkCore;

namespace BookReader.Core.Data;

/// <summary>EF Core context for the app's SQLite database.</summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Setting> Settings => Set<Setting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.Entity<Setting>(e =>
        {
            e.HasKey(s => s.Key);
            e.Property(s => s.Key).HasMaxLength(100);
            e.Property(s => s.Value).HasMaxLength(SettingsService.MaxValueLength);
        });
}
