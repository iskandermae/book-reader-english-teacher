# Epic 0: Foundations (MVP)

Technical enablers that every later story builds on. Order: backend before frontend (see `doc/conventions.md` for layout and commands).

## S0.1 Backend skeleton — Enabler — READY
ASP.NET Core API (`src/BookReader.Api`), core library (`src/BookReader.Core`), SQLite with EF Core migrations, `GET /api/health`.
**Acceptance**
- `dotnet run` starts the API. `GET /api/health` returns 200 with `{"status":"ok"}`.
- On first start a `data/` folder is created beside the executable and a migration creates an empty SQLite database in it (CLAUDE.md application requirements).
- `data/` is git-ignored.
- One backend test (health endpoint) runs green with `dotnet test`, with no network and no Ollama.

## S0.2 API contract — Enabler — READY
Backend owns `api/openapi.json` (`backend-dev`, see agent roster).
**Acceptance**
- `api/openapi.json` is generated from the API and committed.
- A backend test fails if the committed file differs from the generated one (staleness test). The message tells how to regenerate.
- A documented command regenerates the file (in `api/README.md`).
- The file contains `/api/health`.

## S0.3 Frontend skeleton — Enabler — READY
Angular app in `web/` with a typed client generated from `api/openapi.json`.
**Acceptance**
- `npm run api:generate` (in `web/`) generates the client from `api/openapi.json`. Generated code is committed or git-ignored (agent picks one and documents it in `web/README.md`).
- Home page shows "API OK" using the generated client to call `/api/health`. In dev, `ng serve` proxies `/api` to the backend.
- One frontend test runs green with `npm test -- --watch=false` and does not need the backend.
- `npm run build` is green.

## S0.4 CI and local run docs — Enabler — READY
**Acceptance**
- A pipeline runs backend build and tests, frontend build and tests, and the contract staleness test on every push; it is green on a fresh clone.
- README explains prerequisites (.NET, Node, Ollama optional) and a one-command local run that starts API and UI.
- README says that the Ollama model name is a setting and AI features need a local model (D12).

## S0.5 Settings storage (backend) — Story — READY
Key/value settings in SQLite, with API.
**Acceptance**
- `GET /api/settings` returns all settings. `PUT /api/settings` updates one or more keys.
- Validation: unknown keys and values over 1000 chars are rejected with 400 and a clear message.
- Known keys: `ollama.model` (string, empty by default; D12: the model name is never hardcoded) and `ui.sample` (string, sample value for the UI).
- Values survive an app restart (SQLite).
- Unit tests for the settings service (fast, no network). `api/openapi.json` is updated.

## S0.6 Settings page (frontend) — Story — READY
**Acceptance**
- A Settings page, reachable from the home page, shows all settings from the generated client.
- The user can edit `ollama.model` and `ui.sample`, save, and sees a success or error message.
- After restarting backend and reloading, saved values are shown.
- One component test with a mocked client.

## Assumptions and open points
- Default small Ollama model is not chosen here. It comes with the first AI story (Epic 2). `ollama.model` stays empty until then.
- S0.1-S0.2 can run as one backend task if the agent finds it small, but they get separate reviews of their criteria.
- QA review is required per story completion (CLAUDE.md); for tiny enablers one QA pass at the end of S0.2, S0.4, S0.6 is enough.
