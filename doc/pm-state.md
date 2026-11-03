# PM State

Last updated: 2026-10-28

## Phase
Epic 0 and Epic 1 DONE. Epic 2 in progress: S2.1-S2.4, S2.6a-S2.6c DONE, S2.5 dropped, S2.7 postponed. S2.7 (cache) postponed, S2.8 (cloud) dropped.

## Next action
S2.6c DONE 2026-10-28 (QA approved; backend 172 / frontend 142 tests, builds OK). QA minors dropped (hardcoded level list is a commented fixed set; raw inputs for other keys existed before). First `npm test` flaked (vitest worker timeout), rerun passed.
User to review and commit S2.3-S2.6c. Browser checks not done: S2.3c, S2.3d, S2.4, S2.6a, S2.6b, S2.6c (Settings > General fields, model list + Refresh, Ollama down; Prompts variable list). Right-panel text cut-off bug: CSS fix unconfirmed; if still cut, report browser + scrollbar.
S2.7 (cache) POSTPONED by user 2026-10-28 (draft kept in epic file). Epic 2 MVP done. S2.8 DROPPED: cloud Ollama models work through signed-in local Ollama (`...-cloud`, free tier); user confirmed it works. Epic 2 finished. Epic 3: S3.1 groomed 2026-10-28 (copy to data folder, From/To chapter range). S3.1 backend DONE (181 tests, `/api/books/{id}/audio`, 1 GB limit, one file per POST). S3.1 frontend DONE (156 tests, page `/books/:id/audio`, link in library). S3.1 DONE 2026-10-28 (QA approved after 1 fix round; backend 182 / frontend 156 tests). Browser check not done: S3.1 (Library > Audio: upload, overlap message, edit range, remove). QA minors dropped (repeated `<select>` markup, duplicate response type, multi-file overlap by design with hint). User to review and commit S3.1. S3.2 DONE 2026-10-29 (QA approved after 1 fix round: openapi.json regenerated, player bar overlap fixed; backend 187 / frontend 176 tests). Browser check not done: S3.2 (play, seek, skip, speed kept after reload, bar not covering result panel, narrow screen). QA minor dropped (6rem is a fixed estimate). User to review and commit S3.2. S3.3 groomed 2026-11-02 (position in DB, save every 5 s + pause/seek/leave); user OK 2026-11-03; S3.3 backend DONE (189 tests, PUT ./audio/{audioId}/position, positionSeconds in responses); S3.3 DONE 2026-11-03 (QA approved; 3 minors fixed; backend 189 / frontend 185 tests; stale workspace spec fixed). Browser check not done: S3.3 (play >5 s, reload, position restored; play to end, reopen starts at 0). Tab close not saved (accepted). User to review and commit S3.3. S3.4 groomed 2026-11-03 (READY, frontend only; new file loads paused; no-audio bar message); S3.4 DONE 2026-11-03 (QA approved first round; frontend 189 tests, build OK). Browser check not done: S3.4 (2 files + gap chapter). QA minors dropped (private-flag test workaround, cosmetic style). User to review and commit S3.4. S3.5 groomed 2026-11-03 (Ctrl+Left/Right/Space, ignored in text fields); S3.5 DONE 2026-11-03 (QA approved; frontend 195 tests, build OK). Browser check not done: S3.5 (keys work; typing in fields unaffected). QA minors dropped (style, test assertions granularity). Epic 3 finished; user to review and commit S3.3-S3.5. S3.6 Search groomed 2026-11-03 (current book, word match ignoring case/punctuation, jump+highlight); S3.6 backend DONE (207 tests, GET /api/books/{id}/search -> {matches,hasMore}); S3.6 DONE 2026-11-03 (QA approved; max-height fix applied; backend 207 / frontend 208 tests). Browser check not done: S3.6 (search phrase, pick result, highlight, list scrolls). QA minors dropped (position paragraph 0 after jump, list above text, apostrophe Replace nit). Epic 3 all done; user to review and commit S3.3-S3.6. Next: Epic 4 story to groom. Epic 4 after. S3.5 hot keys TODO. S3.4 still TODO. Stop the running API before plain `dotnet test`.
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
