# PM State

Last updated: 2026-11-04

## Phase
Epics 0-3 DONE (history in `doc/pm-state-done.md`). Epic 4 (sync) SKIPPED for now by user 2026-11-04: "overcomplicated". Stories stay TODO in the epic file.

## Next action
Epics 1-3 committed and browser-tested by user 2026-11-04, all fine.
Epic 5 rescoped by user 2026-11-04: only S5.1. S5.1 DONE (dev + QA approved 2026-11-04, 219 tests, build ok). Recorder is in the reader's bottom bar. User to check manually in Chrome/Edge with a real mic, then commit.
S5.2 (hotkeys Ctrl+Enter record, Ctrl+Up play; mic processing off, 128 kbps) DONE: dev + QA approved 2026-11-05, 225 tests, build ok. User to compare replay quality, then commit.
Decision 2026-11-05: user does NOT need stored recordings (recorder stays in-memory, no save/persist stories).
B1 (AI buttons scrolled away; now sticky panel, only result scrolls) DONE: dev + QA approved 2026-11-21, 226 tests, build ok. User to check in browser, then commit. Known limit: --tools-space is fixed 6.5rem (not measured).
B2 (slow first Translate: Ollama keep_alive 30m + background warm-up at startup and on model/url change) DONE: dev + QA approved 2026-11-21, 215 backend tests. User to check real timing (first Translate ~2 s), then commit.
S2.9 (LLM call log, last 10, in memory, `/llm-log` in new tab) DONE: dev + QA approved 2026-11-21, 220 backend / 232 frontend tests. User to check in browser, then commit (B1, B2, S2.9 are all uncommitted).
Open: B2 warm-up may not help `-cloud` models (user uses gpt-oss:120b-cloud); first-Translate 18 s cause unconfirmed; waiting for user's timing after restart.
T1 (run.ps1/run.sh publish API into bin/ and run from there; data in bin/data; ng serve unchanged) DONE: dev + QA approved 2026-11-21. run.sh not run (only bash -n). User to try run.ps1, then commit.
Agent briefs: if an agent starts the app to check it, use ports other than 5027/4200 and stop it afterwards.
B3 (2 CI test failures: git-ignored book/1.txt -> inline-text test; openapi CRLF in XML-doc -> Normalize + regenerated openapi.json) DONE: dev + QA approved 2026-11-21, 220 tests. Needs the next CI run to confirm on Linux. Option for user: `.gitattributes` `* text=auto eol=lf` (fixes line endings at the root, also for run.sh).
Next: groom S7.1 (Epic 7). Epic 6 needs sync, blocked. S7.4 likely obsolete.

## Commit checklist for the user (Epic 0)
- Commit `web/package-lock.json`.
- After `git add`: `git update-index --chmod=+x run.sh`; consider `.gitattributes` (`*.sh text eol=lf`).
- CI never ran; the first push shows if it is green.

## Story board
| Epic | Status |
|---|---|
| 0 Foundations | DONE |
| 1 Library and Reader | DONE except S1.8 (multi-file) TODO |
| 2 AI text tools | DONE (S2.7 cache postponed) |
| 3 Audio player | DONE |
| 4 Text-audio sync | SKIPPED for now |
| 5 Recording | DONE (S5.1 only; manual check pending) |
| 6-7 | TODO (6 blocked by sync) |

PM stories (`pm-next-steps.md`): PM1 DONE. PM2-PM8 TODO.

## Open decisions and questions
- Need from user: one sample mp3 for later stories.
- Stop the running API before plain `dotnet test`.

## Blockers
None.
