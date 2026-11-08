# PM State

Last updated: 2026-11-04

## Phase
Epics 0-3 DONE (history in `doc/pm-state-done.md`). Epic 4 (sync) SKIPPED for now by user 2026-11-04: "overcomplicated". Stories stay TODO in the epic file.

## Next action
Epics 1-3 committed and browser-tested by user 2026-11-04, all fine.
Epic 5 rescoped by user 2026-11-04: only S5.1. S5.1 DONE (dev + QA approved 2026-11-04, 219 tests, build ok). Recorder is in the reader's bottom bar. User to check manually in Chrome/Edge with a real mic, then commit.
S5.2 (hotkeys Ctrl+Enter record, Ctrl+Up play; mic processing off, 128 kbps) DONE: dev + QA approved 2026-11-05, 225 tests, build ok. User to compare replay quality, then commit.
Decision 2026-11-05: user does NOT need stored recordings (recorder stays in-memory, no save/persist stories).
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
