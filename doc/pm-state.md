# PM State

Last updated: 2026-10-28

## Phase
Epic 0 and Epic 1 DONE. Epic 2 in progress: S2.1-S2.3d DONE. S2.4 DONE, S2.5 dropped, S2.6a DONE, S2.6b groomed 2026-10-28 (ready: backend-dev first, then frontend-dev), S2.6c and S2.7 TODO. S2.8 (optional cloud LLM provider, after S2.7, TODO; open: which cloud API) added 2026-10-27.

## Next action
S2.6b groomed (user decisions: seeded Simplify is a normal action; built-ins first then custom in saved order; plain text output). S2.6b DONE 2026-10-28 (QA approved; backend 165 / frontend 133 tests, builds OK). Seeding via EF HasData (accepted); settings+actions saved in 2 non-atomic calls (accepted). User to review and commit; browser check not done (Settings > Prompts: add/edit/delete action, Save; Reader/Text: custom buttons, result title). QA minors dropped (harmless style: redundant name attr, template selector func, `id!`, thin-service test gap). Bug "custom action gone after reload" (2026-10-28) is GONE: user confirmed it works after restart (cause unknown, probably an old API process). backend-dev trimming the extra logs. Done 2026-10-28: EF SQL logs at Warning; rules moved to agent files (frontend never hides errors, backend logging); backend action logs added (165 tests); frontend silent catches removed via `reportError` helper (135 tests, builds OK); no QA round (small follow-up). Waiting: user retries after restart (API + npm start) and sends console/Network info. Next: groom S2.6c (general AI settings), then S2.7, S2.8.
S2.3, S2.3b, S2.3c DONE (QA approved; backend 122 / frontend 95 tests, builds OK). User to review and commit them; S2.3c not checked in a browser yet (`npm start`: select text, Translate, drag divider, reload, narrow window).
Bug from user (2026-10-28): right panel text is cut off by 1-3 chars at the right edge; CSS fix applied (scrollbar-gutter, right padding, overflow-x hidden), unconfirmed in browser. User to check; if still cut, report browser + whether panel has a scrollbar.
User change (2026-10-28): panel keeps the last non-empty selection (preview + buttons stay) until a new non-empty selection or chapter change; DONE (95 -> 98 frontend tests, build OK). Clear button clears the result only; kept selection stays. Small follow-up, no separate QA round.
S2.3d scratchpad DONE (QA approved; backend 127 / frontend 112 tests, builds OK; saves chained, maxlength added). User to review and commit; browser check of the Text page (`/text`: textarea selection incl. drag ending outside, layout, autosave, Clear) not done. S2.4 (Explain) DONE 2026-10-28 (QA approved; backend 135 / frontend 118 tests, builds OK). User to review and commit; browser check of Explain not done. QA minors dropped (cancel covered by Translate tests; IsBlankText style harmless). Postponed: shared host per API test class.
S2.6a (editable Translate/Explain prompts, Prompts tab, Reset to default, `GET /api/settings/defaults`) DONE 2026-10-28 (QA approved; backend 146 / frontend 123 tests, builds OK). User to review and commit; browser check not done (Settings > Prompts: edit, bad template 400, reset, Translate/Explain with edited prompt; Explain with empty sentence). QA minors dropped: hardcoded prompt list/placeholder help text (S2.6b reworks it), Explain 400 on blank native (accepted), CRLF in templates harmless. Stop the running API before plain `dotnet test`. S2.5 dropped; next: S2.6b (custom actions, seeds Simplify) needs grooming, then S2.6c, S2.7, S2.8.
Decided in S2.3: default `language.native`=Ukrainian, Native/Literal output, panel closes on chapter change, `</text>` injection ignored. Decided in S2.3c: panel width stored in setting `reader.panelWidth` (not localStorage).

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
