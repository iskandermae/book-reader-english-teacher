# Epic 4: Text and audio sync (R3)

Depends on: Epics 1 and 3. Biggest technical risk of the project (see D8).

## S4.1 Sentence segmentation — Enabler — TODO
**Acceptance**
- Chapters are split into sentences with stable IDs stored in the DB and exposed via API.
- Unit tests for quotes, abbreviations ("Mr.", "Dr."), ellipses and dialogue.
- Reader can address a sentence by ID.

## S4.2 Alignment spike — Spike — TODO (timeboxed)
Python CLI prototype (WhisperX or forced alignment): audio + chapter text → sentence timestamps JSON.
**Acceptance**
- Tested on at least one real HPMOR chapter and audio.
- Written decision record in `doc/decisions/` covering accuracy, speed, hardware needs, CLI contract (JSON schema).
- Go / no-go and fallback recommendation.

## S4.3 Alignment job — Story — TODO
**Acceptance**
- "Align chapter" button starts the Python CLI from the backend as a background job.
- Progress and errors are shown; timestamps are stored per sentence.
- The feature is hidden or disabled with an explanation if Python tools are not installed.

## S4.4 Highlight the current sentence — Story — TODO
**Acceptance**
- During playback the current sentence is highlighted, within about 0.5 s of the audio.

## S4.5 Follow audio — Story — TODO
**Acceptance**
- Text auto-scrolls to keep the current sentence visible.
- "Follow audio" toggle; manual scrolling switches it off.

## S4.6 Click sentence to seek — Story — TODO
**Acceptance**
- Clicking a sentence seeks the audio to its start time.

## S4.7 Manual offset — Story — TODO
**Acceptance**
- A ±seconds offset per chapter, stored and applied to highlighting.
- Serves as fallback when alignment is imperfect.
