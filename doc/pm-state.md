# PM State

Last updated: 2026-10-26

## Phase
Epic 0 DONE. Epic 1 in progress: S1.1-S1.7b DONE, S1.8 and S1.8b DONE (QA approved). Epic 1 stories all DONE; epic closure pending the slow-test answer.

## Next action
Pick the next epic (Epic 2 AI text tools needs grooming). Slow perf test removed (decision: no committed performance tests; rule added to CLAUDE.md). Epic 1 can be closed. User manual checks done. Stop-hook sound changed to `tada.wav`. Only `README.md` is staged (not ours).

## Commit checklist for the user (Epic 0)
- Commit `web/package-lock.json`.
- After `git add`: `git update-index --chmod=+x run.sh`; consider `.gitattributes` (`*.sh text eol=lf`).
- CI never ran; the first push shows if it is green.
- `packageManager` npm@12.0.2 in `web/package.json` is harmless unless Corepack is enabled.

## Story board
| Epic | Status |
|---|---|
| 0 Foundations | DONE |
| 1 Library and Reader | S1.1-S1.6b DONE; S1.7/S1.7b (appearance) DONE, S1.8 (multi-file) TODO |
| 2 AI text tools | TODO |
| 3-7 | TODO (later releases) |

PM stories (`pm-next-steps.md`): PM1 DONE. PM2-PM8 TODO.

## Open decisions and questions
- Epic 4 stories still to be checked against D11 (epic 1 done: multi-file postponed to S1.8).
- Decided (S1.1): one file per book, editable title defaulting to filename, duplicates allowed.
- Need from user: one sample mp3 (will come with the relevant story).
- Assumption: default Ollama model is chosen in Epic 2; `ollama.model` is empty until then.

## Blockers
None.
