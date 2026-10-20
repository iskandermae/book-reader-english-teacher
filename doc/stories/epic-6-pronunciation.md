# Epic 6: Pronunciation scoring (R5)

Depends on: Epic 5. Must work offline with free models (see constraints).

## S6.1 Pronunciation approach spike — Spike — TODO (timeboxed)
**Acceptance**
- Compare: Whisper transcript diff, phoneme-level scoring (wav2vec2/GOP), cloud speech service.
- Evaluate on a small set of correct vs deliberately mispronounced recordings.
- Decision record in `doc/decisions/` (quality, speed, cost, offline ability).

## S6.2 Transcription service — Enabler — TODO
**Acceptance**
- Endpoint takes a recording and returns transcript with word timings, via a Python CLI (JSON contract) or equivalent chosen in S6.1.
- Tool availability check, like in S4.3.

## S6.3 Word-level comparison — Story — TODO
**Acceptance**
- Expected sentence vs transcript; missed and wrong words are highlighted in the sentence.

## S6.4 Sentence score — Story — TODO
**Acceptance**
- Score 0-100 with a short explanation.
- Scoring logic is deterministic and unit-tested.

## S6.5 Score history — Story — TODO
**Acceptance**
- History per sentence and per chapter, with a simple progress view.

## S6.6 AI pronunciation feedback — Story — TODO
**Acceptance**
- For mistaken words the LLM explains how to pronounce them, using `ILlmProvider`.

## S6.7 Phoneme-level feedback — Story (stretch) — TODO
**Acceptance**
- Only started if S6.1 shows it is feasible with free local tools. Scope defined after the spike.
