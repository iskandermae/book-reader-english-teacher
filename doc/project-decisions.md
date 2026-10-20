# Project Decisions

Status: living document. Every change to a decision is recorded in the Change log at the bottom.

## Goal
A web application for reading a book and learning English: read a text book, listen to the audiobook with synchronized text, record and check your own voice, and use AI tools (translate, explain, simplify) on selected text.

## Constraints
- **No subscriptions required.** The whole product must work with free local Ollama models. A cloud model is an optional enhancement (faster and better quality), never a requirement.
- Reasonable resource spending: small stories, cheap models for routine work, spikes are timeboxed.
- Single-user, local-first. No auth in scope.

## Decisions
| # | Topic | Decision | Rationale |
|---|---|---|---|
| D1 | Application type | Web app: Angular frontend + ASP.NET Core backend. Not MAUI | Rich reading UI, text selection, `<audio>` and `MediaRecorder` are native in the browser. Team knows Angular and C#. Can be wrapped (PWA/Electron/Tauri) later |
| D2 | Database | SQLite (EF Core, migrations) | Single user, zero-setup |
| D3 | Book format | `.txt` only. Chapters detected by a configurable regex | Target books are free-distributed, e.g. hpmor.com |
| D4 | Audio | Local audio files attached by the user. A book can have several audio files (e.g. one per chapter; to be confirmed with the user) | No TTS in scope |
| D5 | LLM access | `ILlmProvider` abstraction. Implementations: Ollama (first), cloud (later, optional). Cloud API key is stored on the backend only | Keeps the product free by default |
| D6 | Ollama client | Use the OllamaSharp .NET library from C#. Python is NOT used for LLM calls | Mature library, less moving parts |
| D7 | Python | Optional, isolated behind CLI tools with a JSON-in/JSON-out contract. Used only for audio-to-text alignment and, if chosen, pronunciation scoring | Python ecosystem (WhisperX, wav2vec2) is the best fit for speech |
| D8 | Text-audio sync | Sentence-level timestamps produced by forced alignment (spike S4.2 validates). Fallback: chapter-level audio with manual offset | Alignment quality is the biggest technical risk |
| D9 | Pronunciation scoring | Required. Approach decided by spike S6.1 (Whisper transcript diff vs phoneme-level vs cloud). Local/offline preferred | Whisper tends to auto-correct mispronunciation, so the approach needs validation |
| D10 | Delivery | Small stories (about 300 changed lines or fewer), each testable and bringing user value or a named technical enabler | Comfortable code review and testing |

## Change log
- 2026-10-18: Initial decisions D1-D10 approved.
