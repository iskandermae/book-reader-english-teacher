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

## S2.2 Text selection toolbar — Story — TODO
**Acceptance**
- Selecting text in the reader shows a floating toolbar near the selection.
- The selected text and its surrounding sentence are captured as context.
- Toolbar hides when the selection is cleared.
- Works with mouse and keyboard selection.

## S2.3 Translate selection — Story — TODO
**Acceptance**
- "Translate" sends selection + context to the backend; the result streams into a side panel.
- Target language comes from settings (see S2.6; a default is used before that).
- If Ollama is unavailable, a clear error with a hint is shown.

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
- The program prepares the prompt, executes it and put the result to the resulting text box  
- Settings for native language, English level, Ollama URL and model (chosen from the installed list).
- Prompts for S2.3-S2.5 use these settings.

## S2.7 Cache AI results — Enabler — TODO
**Acceptance**
- Results are cached in SQLite per (selection, context hash, action, model, settings).
- A repeated request returns without calling the model.
- Cache can be cleared from the Settings page.
