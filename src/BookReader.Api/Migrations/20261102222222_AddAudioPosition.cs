using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookReader.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAudioPosition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "PositionSeconds",
                table: "AudioFiles",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PositionSeconds",
                table: "AudioFiles");
        }
    }
}
