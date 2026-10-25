using BookReader.Core.Books;
using BookReader.Core.Settings;
using Microsoft.EntityFrameworkCore;

namespace BookReader.Core.Data;

/// <summary>EF Core context for the app's SQLite database.</summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<Book> Books => Set<Book>();
    public DbSet<Chapter> Chapters => Set<Chapter>();
    public DbSet<Paragraph> Paragraphs => Set<Paragraph>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Setting>(e =>
        {
            e.HasKey(s => s.Key);
            e.Property(s => s.Key).HasMaxLength(100);
            e.Property(s => s.Value).HasMaxLength(SettingsService.MaxValueLength);
        });

        modelBuilder.Entity<Book>(e =>
        {
            e.Property(b => b.Title).HasMaxLength(BookImportService.MaxTitleLength);
            e.HasMany(b => b.Chapters).WithOne().HasForeignKey(c => c.BookId).OnDelete(DeleteBehavior.Cascade);
        });

        // Unique (parent, index) keeps order stable and gives the reader a fast lookup of a chapter / paragraph.
        modelBuilder.Entity<Chapter>(e =>
        {
            e.HasIndex(c => new { c.BookId, c.Index }).IsUnique();
            e.HasMany(c => c.Paragraphs).WithOne().HasForeignKey(p => p.ChapterId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Paragraph>(e => e.HasIndex(p => new { p.ChapterId, p.Index }).IsUnique());
    }
}
