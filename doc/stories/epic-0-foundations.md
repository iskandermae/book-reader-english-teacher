# Epic 0: Foundations (MVP)

Technical enablers that every later story builds on.

## S0.1 Solution skeleton — Enabler — TODO
Angular app, ASP.NET Core API, SQLite with EF Core migrations, `/api/health` endpoint.
**Acceptance**
- `dotnet run` and `ng serve` (or one script) start both parts.
- The UI home page shows "API OK" fetched from `/api/health`.
- A migration creates an empty database on first start.
- One backend test and one frontend test run green.

## S0.2 CI and local run docs — Enabler — TODO
**Acceptance**
- A build/test pipeline (backend + frontend) runs on every push and is green on a fresh clone.
- README explains a one-command local run and prerequisites (.NET, Node, Ollama).

## S0.3 Settings storage — Story — TODO
Key/value settings in SQLite with API and a basic Settings page.
**Acceptance**
- `GET/PUT /api/settings` with validation.
- The Settings page can edit and save a sample value; it survives a restart.
- Unit tests for the settings service.
