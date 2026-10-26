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

## S2.3 Translate selection — Story
**Acceptance**
- Backend: `POST /api/llm/translate` `{ text, context }` streams SSE (same format as `/api/llm/test`). The prompt translates the selected `text` only into the target language. `context` is accepted (and may be passed to the model as a meaning hint only if that does not change the output scope); it is kept in the API for S2.6 custom prompts.
- New setting `language.native`, default `Ukrainian`. It is the target language, read on each call. No UI for it until S2.6.
- Prompt building is a pure, unit-tested function (selection, target language -> prompt). The model output is the translation only (no preface).
- Errors: empty `text` -> 400; empty `ollama.model` -> 400 "Choose a model in settings"; Ollama down -> 503 with hint (same mapping as S2.1).
- `api/openapi.json` updated. Unit tests with the fake provider (streaming, prompt content, error mapping); no network.
- Frontend: a "Translate" button in the selection toolbar opens a right side panel; the translation streams into it. The panel is reusable by S2.4/S2.5 (title + streamed text + error area + close button). Closing the panel or starting a new request cancels the running one.
- Error from the backend (e.g. Ollama down) is shown in the panel with its hint.
- Frontend tests: panel shows streamed chunks, shows an error, cancels on close (service mocked).
- Out of scope: settings UI (S2.6), caching (S2.7), context/sentence/paragraph placeholders (S2.6).

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
