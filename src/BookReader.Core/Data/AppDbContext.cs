using BookReader.Core.Actions;
using BookReader.Core.Books;
using BookReader.Core.Scratchpad;
using BookReader.Core.Settings;
using Microsoft.EntityFrameworkCore;

namespace BookReader.Core.Data;

/// <summary>EF Core context for the app's SQLite database.</summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<ScratchpadText> Scratchpad => Set<ScratchpadText>();
    public DbSet<CustomAction> CustomActions => Set<CustomAction>();
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

        // Single row (Id = 1); the text limit is enforced by the service, not the column.
        modelBuilder.Entity<ScratchpadText>(e => e.ToTable("Scratchpad"));

        // Seed data goes into the migration, so it is inserted once and deleting it later is final.
        modelBuilder.Entity<CustomAction>(e =>
        {
            e.Property(a => a.Name).HasMaxLength(CustomActionService.MaxNameLength);
            e.Property(a => a.Prompt).HasMaxLength(SettingsService.MaxPromptLength);
            e.HasData(new CustomAction
            {
                Id = CustomAction.SimplifyId, Name = CustomAction.SimplifyName, Prompt = CustomAction.SimplifyPrompt, Position = 0,
            });
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
