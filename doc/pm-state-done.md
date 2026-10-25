# PM State - Done (history)

- Decisions D1-D10 written (`project-decisions.md`).
- Stories for epics 0-7 written (`doc/stories/`).
- Memory mechanism created: `CLAUDE.md`, pm-state, SessionStart hook.
- PM1: 4 agents created in `.claude/agents/`; roster in `project-decisions.md`.
- Q1 answered (D11). Q3 answered: no hardware dependency (D12). Sample text: `book/1.txt`.
- 2026-10-25: Epic 0 groomed and split into S0.1-S0.6.
- 2026-10-25: Epic 0 DONE (S0.1-S0.6), QA approved in three passes. Backend 10 tests, frontend 4 tests green. Not committed.
  - Backend skeleton, `api/openapi.json` with staleness test (regenerate: `UPDATE_OPENAPI=1 dotnet test --filter OpenApiContractTests`).
  - Angular app in `web/`, generated client git-ignored, dev proxy verified live.
  - GitHub Actions CI, `run.ps1`/`run.sh`, README.
  - Settings API + page (`ollama.model`, `ui.sample`).
- 2026-10-25: Cleanup S0.7 (backend: shared test base, exception filter, HTTP tests, retry on concurrent first PUT) and S0.8 (settings page: signals, load-failed test) DONE, QA approved. 13 backend + 5 frontend tests green.
