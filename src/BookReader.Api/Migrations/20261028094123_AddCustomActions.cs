using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookReader.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomActions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CustomActions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    Prompt = table.Column<string>(type: "TEXT", maxLength: 4000, nullable: false),
                    Position = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomActions", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "CustomActions",
                columns: new[] { "Id", "Name", "Position", "Prompt" },
                values: new object[] { 1, "Simplify (B2)", 0, "Rewrite the text below in simple English at about B2 level. Keep the meaning. Use the sentence only as context; do not rewrite it. Output only the rewritten text.\n\nText: {selection}\nContext sentence (may be empty): {sentence}" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CustomActions");
        }
    }
}
