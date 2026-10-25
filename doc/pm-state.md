# PM State

Last updated: 2026-10-25

## Phase
Planning. No product code yet. Worker agents are defined.

## Next action
Start S0.1 (backend skeleton) with `backend-dev`. Then S0.2 (contract), S0.3 (frontend), S0.4 (CI/docs), S0.5-S0.6 (settings). QA after S0.2, S0.4, S0.6.

## Current sprint
Sprint 1 = Epic 0 (S0.1-S0.6). Not started.

## Story board
| Epic | Status |
|---|---|
| 0 Foundations | READY (groomed 2026-10-25, split into S0.1-S0.6) |
| 1 Library and Reader | TODO |
| 2 AI text tools | TODO |
| 3-7 | TODO (later releases) |

PM stories (`pm-next-steps.md`): PM1 DONE. PM2-PM8 TODO.

## Open decisions and questions
- Check epics 1 and 4 stories still match D11 (one audio file can cover several chapters; book can be one or many `.txt` files).
- Need from user: one sample mp3 (will come with the relevant story).

- Assumption: default Ollama model is chosen in Epic 2; `ollama.model` setting is empty until then.

## Blockers
None.

## Done (archive, one line each)
- Decisions D1-D10 written (`project-decisions.md`).
- Stories for epics 0-7 written (`doc/stories/`).
- Memory mechanism created: `CLAUDE.md`, this file, SessionStart hook.
- PM1: 4 agents created in `.claude/agents/`; roster in `project-decisions.md`.
- Q1 answered (D11). Q3 answered: no hardware dependency (D12). Sample text: `book/1.txt`.
