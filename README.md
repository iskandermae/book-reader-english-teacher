# Book Reader English Teacher

A web application for reading a book, listening to its audiobook, recording your voice, and learning English with AI tools.

Stack: Angular, ASP.NET Core, SQLite. Local Ollama models are the default; cloud models are optional.

## Prerequisites
- [.NET SDK 10](https://dotnet.microsoft.com/download)
- [Node.js 24](https://nodejs.org/) (with npm)
- [Ollama](https://ollama.com/)

## Run locally
1. Start Ollama
2. start the API (http://localhost:5027), the UI (http://localhost:4200)
```powershell
./run.ps1
```
3. Add ollama model in the settings (take it from the output of command line command: "ollama list")

Open http://localhost:4200. The UI proxies `/api` to the API (`web/proxy.conf.json`). On the first run the script installs the npm packages (`npm ci`).

## Build and test
| What | Command |
|---|---|
| Backend build / tests | `dotnet build` / `dotnet test` |
| Frontend build / tests | `npm run build` / `npm test -- --watch=false` (in `web/`) |

CI (GitHub Actions, `.github/workflows/ci.yml`) runs all of these on every push. `dotnet test` includes the API contract staleness test; see [api/README.md](api/README.md) for how to regenerate `api/openapi.json`. Do not set `UPDATE_OPENAPI` in CI.

## AI features and Ollama
AI features need a local Ollama model. The model name is a setting (`ollama.model`, empty by default) and is never hardcoded. Pull a model with `ollama pull <name>` and set its name in the app settings.

## Data folder
All app data (database, settings, generated files) is stored in a `data` folder beside the executable. Under `dotnet run` this is `src/BookReader.Api/bin/Debug/net10.0/data`, so it is lost when the project is cleaned.

## More
- [api/README.md](api/README.md) - API contract
- [web/README.md](web/README.md) - frontend
- [doc/conventions.md](doc/conventions.md) - repo layout and conventions
