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

- 2026-10-28 history moved from pm-state (S2.3-S2.6b):
  S2.6b groomed (user decisions: seeded Simplify is a normal action; built-ins first then custom in saved order; plain text output). S2.6b DONE 2026-10-28 (QA approved; backend 165 / frontend 133 tests, builds OK). Seeding via EF HasData (accepted); settings+actions saved in 2 non-atomic calls (accepted). User to review and commit; browser check not done (Settings > Prompts: add/edit/delete action, Save; Reader/Text: custom buttons, result title). QA minors dropped (harmless style: redundant name attr, template selector func, `id!`, thin-service test gap). Bug "custom action gone after reload" (2026-10-28) is GONE: user confirmed it works after restart (cause unknown, probably an old API process). backend-dev trimming the extra logs. Done 2026-10-28: EF SQL logs at Warning; rules moved to agent files (frontend never hides errors, backend logging); backend action logs added (165 tests); frontend silent catches removed via `reportError` helper (135 tests, builds OK); no QA round (small follow-up). Waiting: user retries after restart (API + npm start) and sends console/Network info. S2.6c groomed 2026-10-28, user OK (CEFR A1-C2 default B2, free-text languages, model select from installed list; added: variable list with descriptions from backend shown on Settings). Backend DONE (172 tests, build OK; `GET /api/settings/placeholders`; `language.level` added). Frontend DONE (142 tests, build OK; first npm test run flaked with vitest worker timeout, rerun passed). QA running. Then S2.7, S2.8.
  S2.3, S2.3b, S2.3c DONE (QA approved; backend 122 / frontend 95 tests, builds OK). User to review and commit them; S2.3c not checked in a browser yet (`npm start`: select text, Translate, drag divider, reload, narrow window).
  Bug from user (2026-10-28): right panel text is cut off by 1-3 chars at the right edge; CSS fix applied (scrollbar-gutter, right padding, overflow-x hidden), unconfirmed in browser. User to check; if still cut, report browser + whether panel has a scrollbar.
  User change (2026-10-28): panel keeps the last non-empty selection (preview + buttons stay) until a new non-empty selection or chapter change; DONE (95 -> 98 frontend tests, build OK). Clear button clears the result only; kept selection stays. Small follow-up, no separate QA round.
  S2.3d scratchpad DONE (QA approved; backend 127 / frontend 112 tests, builds OK; saves chained, maxlength added). User to review and commit; browser check of the Text page (`/text`: textarea selection incl. drag ending outside, layout, autosave, Clear) not done. S2.4 (Explain) DONE 2026-10-28 (QA approved; backend 135 / frontend 118 tests, builds OK). User to review and commit; browser check of Explain not done. QA minors dropped (cancel covered by Translate tests; IsBlankText style harmless). Postponed: shared host per API test class.
  S2.6a (editable Translate/Explain prompts, Prompts tab, Reset to default, `GET /api/settings/defaults`) DONE 2026-10-28 (QA approved; backend 146 / frontend 123 tests, builds OK). User to review and commit; browser check not done (Settings > Prompts: edit, bad template 400, reset, Translate/Explain with edited prompt; Explain with empty sentence). QA minors dropped: hardcoded prompt list/placeholder help text (S2.6b reworks it), Explain 400 on blank native (accepted), CRLF in templates harmless. Stop the running API before plain `dotnet test`. S2.5 dropped; next: S2.6b (custom actions, seeds Simplify) needs grooming, then S2.6c, S2.7, S2.8.

- 2026-11-04 history moved from pm-state (Epic 2 end, Epic 3):
  - Epic 2 DONE: S2.1-S2.4, S2.6a-S2.6c DONE; S2.5 dropped; S2.7 (cache) postponed (draft in epic file); S2.8 (cloud) dropped (cloud models work via signed-in local Ollama `...-cloud`). Last counts: backend 172 / frontend 142 tests.
  - Epic 3 DONE: S3.1 attach audio (copy to data folder, chapter range, 1 GB limit), S3.2 player bar, S3.3 remember position (DB, saved every 5 s + pause/seek/leave; tab close not saved, accepted), S3.4 multi-file/gap chapter, S3.5 hot keys (Ctrl+Left/Right/Space, ignored in text fields), S3.6 text search (`GET /api/books/{id}/search`). All QA approved. Final counts: backend 207 / frontend 208 tests, builds OK.
  - S3.6 browser check done (over-scroll bug fixed). Other QA minors were dropped.
  - Decided: default `language.native`=Ukrainian; panel width in `reader.panelWidth`; level CEFR A1-C2 default B2; variables from `GET /api/settings/placeholders`.
  - Open question closed: right-panel text cut-off CSS fix unconfirmed (reopen only if user sees it again).
