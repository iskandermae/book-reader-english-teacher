# PM State

Last updated: 2026-10-26

## Phase
Epic 0 and Epic 1 DONE. Epic 2 in progress: S2.1-S2.3 DONE. S2.4-S2.7 TODO (need grooming).

## Next action
S2.3b DONE (QA approved; backend 113 tests in ~3 s). User to review and commit S2.3 + S2.3b. Next: groom S2.4. Postponed: shared host per API test class (would cut ~25 s summed). Frontend tests: nothing to fix (tooling startup only).
S2.3 DONE (QA approved round 2; backend 113 / frontend 87 tests, builds OK). User to review and commit. Then groom S2.4 (Explain), reusing the S2.3 panel and `/api/llm/translate` pattern. Note: S2.4/S2.5 should move LlmService SSE/error handling into a shared helper (frontend-dev proposal). Decided in S2.3: default `language.native`=Ukrainian, Native/Literal output, panel closes on chapter change, `</text>` injection ignored.

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
