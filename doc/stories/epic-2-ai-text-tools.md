# Epic 2: AI text tools (MVP)

Depends on: Epic 1. MVP is complete after S2.7.

## S2.1 LLM provider abstraction with Ollama — Enabler (backend only) — DONE
**Acceptance**
- `ILlmProvider` interface (streaming text generation, model list, availability check) and an Ollama implementation using OllamaSharp (D5, D6).
- New setting `ollama.url`, default `http://localhost:11434`. The provider reads `ollama.url` and `ollama.model` from settings on each call (no restart needed).
- `GET /api/llm/status`: returns `{ available, url, model, error? }`. Never throws when Ollama is down.
- `GET /api/llm/models`: installed model names. Ollama down -> 503 with a clear message and hint ("Start Ollama...").
- `POST /api/llm/test` `{ prompt }`: streams text as Server-Sent Events (this is the streaming format S2.3-S2.5 will reuse). Empty `ollama.model` -> 400 "Choose a model in settings". Ollama down -> 503 with hint.
- `api/openapi.json` updated.
- Unit tests with a fake provider (status, models, streaming, error mapping); no network, no Ollama. The Ollama implementation is covered by one optional integration test, excluded from the default run (category/trait).
- Out of scope: frontend, model picker UI (S2.6), prompts (S2.3+), cloud providers.

## S2.2 Text selection toolbar — Story (frontend only) — DONE
**Acceptance**
- Selecting text inside the chapter text (`article p`) shows a floating toolbar just above the selection (below it if there is no room above), kept inside the viewport.
- Selection is captured as `{ text, context }`. `text` is the trimmed selection. `context` is the full sentence(s) containing the selection, taken from the same paragraph only. If the selection spans several paragraphs, context is those paragraphs' text. Sentence split is simple (`. ! ?` followed by space); no NLP.
- The capture logic is a pure function in its own file (not inside `ReaderComponent`) and is unit tested: one sentence, selection in the middle sentence, first/last sentence, paragraph without punctuation, multi-paragraph, whitespace-only selection.
- The toolbar is its own small component; the reader exposes the current selection to it via a signal. Buttons are added by S2.3-S2.5; here the toolbar only shows a short preview of the selected text (so the user can verify it).
- Toolbar hides when the selection is collapsed/cleared, when the chapter changes, and on selection outside the chapter text (menus, settings, nav).
- Works with mouse and keyboard (Shift+arrows) selection; updates on `selectionchange` (debounced, no per-keystroke work).
- Clicking the toolbar must not clear the selection (mousedown prevented).
- Listeners are removed on destroy.
- Tests: component test that a selection event shows and clears the toolbar (jsdom Selection mocked); no real positioning asserted.
- Out of scope: actions/buttons, API calls, touch-specific handles, highlighting saved selections.
- Assumption: no buttons yet, so the user verifies by selecting text and seeing the preview.

## S2.3 Translate selection — Story — DONE
**Acceptance**
- Backend: `POST /api/llm/translate` `{ text, context }` streams SSE (same format as `/api/llm/test`). The prompt translates the selected `text` only into the target language. `context` is accepted (and may be passed to the model as a meaning hint only if that does not change the output scope); it is kept in the API for S2.6 custom prompts.
- New setting `language.native`, default `Ukrainian`. It is the target language, read on each call. No UI for it until S2.6.
- Prompt building is a pure, unit-tested function (selection, target language -> prompt). The model output is two lines and no preface: `Native: ...` (as native speakers would say) and `Literal: ...` (word-for-word). The panel shows this text as is (decided by the user).
- The side panel closes (and cancels the running request) when the chapter changes.
- Errors: empty `text` -> 400; empty `ollama.model` -> 400 "Choose a model in settings"; Ollama down -> 503 with hint (same mapping as S2.1).
- `api/openapi.json` updated. Unit tests with the fake provider (streaming, prompt content, error mapping); no network.
- Frontend: a "Translate" button in the selection toolbar opens a right side panel; the translation streams into it. The panel is reusable by S2.4/S2.5 (title + streamed text + error area + close button). Closing the panel or starting a new request cancels the running one.
- Error from the backend (e.g. Ollama down) is shown in the panel with its hint.
- Frontend tests: panel shows streamed chunks, shows an error, cancels on close (service mocked).
- Out of scope: settings UI (S2.6), caching (S2.7), context/sentence/paragraph placeholders (S2.6).

## S2.3b Fast "Ollama is down" tests — Enabler (backend only) — DONE
**Acceptance**
- The 3 `OllamaProviderTests` "server is down" tests (Models, Generate, Status) no longer open a real socket (today ~2 s each on Windows). They use a fake `HttpMessageHandler`/client that throws `HttpRequestException`, or an equivalent injection that needs no production redesign.
- Same assertions as today (unavailable error, status does not throw and gives a hint). Merge into one `Theory` only if they differ just by the call.
- Each of the three runs in well under 100 ms. No timing assertions are committed.
- Out of scope: shared host per test class, in-memory SQLite (postponed; the other API tests are ~1.5 s each under parallel load).

## S2.3c Workspace layout: fixed action bar and result panel — Story (backend + frontend) — DONE
Decided with the user: the floating toolbar and the overlay panel (S2.2/S2.3) are replaced. S2.4/S2.5/S2.6 only add buttons.
**Acceptance**
- Backend (first): new setting `reader.panelWidth`, default `40` (percent of the page width), allowed range 20-70 (else validation error like the other `reader.*` settings). Defaults line, validation, `api/openapi.json` description, unit test. Needed because the app stores all data in `data`, not in browser localStorage (found by frontend-dev).
- The reader page is a split view: text on the left, a result panel on the right (default ~40% of the workspace width, i.e. the area right of the chapter list). The panel never overlays the text. On narrow screens the panel is stacked under the text.
- The divider is draggable (mouse; keyboard arrows when it is focused). The width is remembered across reloads, the same way reader appearance settings are.
- The panel has a fixed action bar on top: the "Translate" button (more buttons come with S2.4-S2.6). Buttons are always visible and disabled while nothing is selected.
- The panel shows a short preview of the current selection (the job of the old toolbar), then the streamed result, then errors with hints (as today). Close button is replaced by "Clear". Cancel and stale-chunk behavior from S2.3 stay (new request or chapter change cancels and clears).
- The floating toolbar is removed. Selection capture (`capture-selection.ts`) and its tests stay.
- The workspace (split view, action bar, preview, result, divider) is its own component with inputs/outputs that do not depend on `ReaderComponent`, so S2.3d can reuse it with another text source.
- Tests: component tests for enabled/disabled buttons, preview, streamed result, error, clear/cancel, divider keyboard resize and remembered width (service mocked). No layout pixel assertions.
- Out of scope: new AI actions, scratchpad (S2.3d), touch-specific resizing.
- Note: with the toolbar gone, selecting text is not cleared by clicking an action button (mousedown on the bar must not clear the selection).

## S2.3d Scratchpad: work with pasted text — Story (backend + frontend) — DONE
Depends on S2.3c.
**Acceptance**
- Backend: `GET /api/scratchpad` returns `{ text }` (empty when never set); `PUT /api/scratchpad` `{ text }` saves it. Stored in SQLite, one row, in the `data` folder as all app data. Limit 200,000 characters (400 above). `api/openapi.json` updated. Unit tests (default empty, save, replace, over the limit).
- Frontend: a "Text" page reachable from the main navigation. It uses the workspace from S2.3c with an editable text area as the left side. Selecting text in it works exactly like in the reader (same buttons, preview, result).
- Selection capture works in a text area (selectionStart/End) and produces `{ text, context }` with the same rules as S2.2; a pure function with unit tests.
- Text is saved automatically (debounced) and restored on return. "Clear text" button with confirmation.
- Tests: page loads saved text, saves after edit (debounce with fake timers), capture from a text area, selecting enables buttons.
- Out of scope: several scratchpads, saving results, importing the pasted text as a book.
- Assumption: a single scratchpad; the whole text is the only context for sentence/paragraph rules.

## S2.4 Explain selection — Story — TODO
**Acceptance**
- "Explain" gives meaning, grammar and usage in this context.
- Same streaming and error behavior as S2.3.

## S2.5 Simplify selection — Story — TODO
**Acceptance**
- "Simplify" rewrites the selection at a level B2.
- Same streaming and error behavior as S2.3.

## S2.6 AI settings — Story — TODO
**Acceptance**
- Settings for 1-20 more dynamic actions - the same implementation as "Simplify selection" but according to user's settings
- Example: Explain selection, Rewrite selection in B2 english, and so on
- User create setting with: name, prompt template (with {selection}, {from_language}, {target_language} substrings, where selected text|languages are inserted)
- Also offer {sentence} (context sentence) and {paragraph} placeholders (decided in S2.3 grooming: translate uses the selection only).
- The program prepares the prompt, executes it and put the result to the resulting text box  
- Settings for native language, English level, Ollama URL and model (chosen from the installed list).
- Prompts for S2.3-S2.5 use these settings.

## S2.7 Cache AI results — Enabler — TODO
**Acceptance**
- Results are cached in SQLite per (selection, context hash, action, model, settings).
- A repeated request returns without calling the model.
- Cache can be cleared from the Settings page.

## S2.8 Optional cloud LLM provider — Story (backend + frontend) — TODO
Depends on S2.6 (settings UI) and S2.7 (cache key includes provider and model). Outside the MVP: the app must stay fully usable with Ollama only (D5).
**Acceptance (high level, to groom)**
- A second `ILlmProvider` implementation for one cloud API; the provider is chosen by a setting (`llm.provider`: `ollama` default, or `cloud`). Provider is picked per call from settings (no restart).
- Settings: provider, cloud model, API key. The key is stored on the backend only and never returned by the API (only "key is set").
- Settings UI: provider switch, model, API key field, "Test connection".
- Same streaming (SSE) and error mapping as Ollama (missing key -> 400 with hint, network/401 -> clear message).
- Unit tests with a fake HTTP handler; no network.
- Open questions: which cloud API (OpenAI-compatible or Anthropic)? Model list or free text? Is a per-action provider needed?
