# Project Management: Next Steps

Stories for the project manager (PM) role: how the project is led, staffed and steered. Separate from product stories in `stories/`.

## PM1 Define the AI agent team — DONE (2026-10-21)
Create agent definitions in `.claude/agents/`, each with a narrow role and the cheapest model that fits.
| Agent | Role | Suggested model tier |
|---|---|---|
| backend-dev | C# / ASP.NET Core / EF Core / SQLite stories | mid |
| frontend-dev | Angular stories (components, services, UI) | mid |
| qa-reviewer | Code review and test verification against acceptance criteria. Read-only on production code, gives an independent read | mid |

**Acceptance:** each agent has a written brief (scope, conventions, what it must not touch); the roster and cost rationale are recorded in `project-decisions.md`.

## PM2 Set engineering conventions — TODO
**Acceptance:** a short `CLAUDE.md` / `doc/conventions.md` with repo layout, naming, branching, test commands and PR size rule, so agents produce consistent code.

## PM3 Create the project strategy and backlog board — TODO
**Acceptance:** `doc/strategy.md` with the release order, sprint/iteration cadence, a story status board (updated by the PM after each story), and review gates (qa-reviewer approves before a story is DONE).

## PM4 Run Sprint 1: Epic 0 (S0.1-S0.3) — TODO
**Acceptance:** each story is assigned to an agent with a brief that includes acceptance criteria; the PM verifies results (build and tests actually run) before marking DONE.

## PM5 Run Sprint 2: Epic 1 (S1.1-S1.5) — TODO
**Acceptance:** same gates as PM4. Includes testing against a real HPMOR text file.

## PM6 Run Sprint 3: Epic 2 (S2.1-S2.7) and declare MVP — TODO
**Acceptance:** MVP demo checklist passes with a free local Ollama model; record the model used and its measured speed.

## PM7 Early risk spikes — TODO
Run S4.2 (alignment) and S6.1 (pronunciation) right after MVP, or in parallel if the budget allows, so the strategy for R3-R5 can change early.
**Acceptance:** decision records written; `strategy.md` and `project-decisions.md` updated (go/no-go, fallbacks, re-ordered releases).

## PM8 Retrospective and strategy update after each release — TODO
**Acceptance:** a short note per release: what was delivered, token/effort spent vs expectation, problems, strategy changes.

## Open items needing the user
- Q1: Is the audiobook one file per chapter? (affects S3.1 and S4.3)
- Q3: Which hardware and Ollama models are available?
- Provide a sample HPMOR `.txt` and one chapter audio for testing.
