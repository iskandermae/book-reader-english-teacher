# Conventions

## Repo layout
| Path | Content |
|---|---|
| `src/BookReader.Api/` | ASP.NET Core host |
| `src/BookReader.Core/` | Business logic, `ILlmProvider`, EF Core |
| `tests/BookReader.Tests/` | Backend unit tests |
| `web/` | Angular GUI |
| `api/` | API contract |
| `tools/` | Command-line tools, one folder each, with a short README |
| `data/` | Runtime data. Git-ignored |
| `doc/` | Project docs (PM) |
| `book/` | Sample texts for manual tests |

## Naming
- Stories and commits use the story ID, for example `S1.4`.

## Build and test commands
| What | Command |
|---|---|
| Backend build / tests | `dotnet build` / `dotnet test` |
| Frontend build / tests | `npm run build` / `npm test -- --watch=false` (in `web/`) |
