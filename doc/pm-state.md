# PM State

Last updated: 2026-10-25

## Phase
Epic 0 DONE (not committed). Epic 1 in progress: S1.1 DONE, others TODO.

## Next action
S1.4 DONE (QA approved, 45 backend tests pass, not committed). Groom S1.5 (reader page, frontend; also library titles become links to the reader). User still needs to review and commit Epic 0 and S1.1-S1.4 (S1.3 has staged `git rm` deletions of the old home page).

## Commit checklist for the user (Epic 0)
- Commit `web/package-lock.json`.
- After `git add`: `git update-index --chmod=+x run.sh`; consider `.gitattributes` (`*.sh text eol=lf`).
- CI never ran; the first push shows if it is green.
- `packageManager` npm@12.0.2 in `web/package.json` is harmless unless Corepack is enabled.

## Story board
| Epic | Status |
|---|---|
| 0 Foundations | DONE |
| 1 Library and Reader | S1.1-S1.4 DONE; S1.5 (reader page), S1.6 (position), S1.7 (appearance), S1.8 (multi-file) TODO |
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
