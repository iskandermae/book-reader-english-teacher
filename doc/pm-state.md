# PM State

Last updated: 2026-10-28

## Phase
Epic 0 and Epic 1 DONE. Epic 2 in progress: S2.1-S2.4, S2.6a-S2.6c DONE, S2.5 dropped, S2.7 postponed. S2.7 (cache) postponed, S2.8 (cloud) dropped.

## Next action
S2.6c DONE 2026-10-28 (QA approved; backend 172 / frontend 142 tests, builds OK). QA minors dropped (hardcoded level list is a commented fixed set; raw inputs for other keys existed before). First `npm test` flaked (vitest worker timeout), rerun passed.
User to review and commit S2.3-S2.6c. Browser checks not done: S2.3c, S2.3d, S2.4, S2.6a, S2.6b, S2.6c (Settings > General fields, model list + Refresh, Ollama down; Prompts variable list). Right-panel text cut-off bug: CSS fix unconfirmed; if still cut, report browser + scrollbar.
S2.7 (cache) POSTPONED by user 2026-10-28 (draft kept in epic file). Epic 2 MVP done. S2.8 DROPPED: cloud Ollama models work through signed-in local Ollama (`...-cloud`, free tier); user confirmed it works. Epic 2 finished. Next: groom Epic 3. Stop the running API before plain `dotnet test`.
Decided: default `language.native`=Ukrainian; panel width in `reader.panelWidth`; level CEFR A1-C2 default B2; variables from `GET /api/settings/placeholders`.

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
