using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookReader.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBookLastOpenedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastOpenedAt",
                table: "Books",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastOpenedAt",
                table: "Books");
        }
    }
}
