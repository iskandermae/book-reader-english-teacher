# Epic 5: Voice recording (R4)

Rescoped 2026-11-04 (user): no sync, so no per-sentence practice. Recording is manual and lives only in the browser. Nothing is stored in the backend.

## S5.1 Record and play back — Story — DONE (manual Chrome/Edge check by user pending)
**Decisions**
- Controls live in the reader's fixed bottom bar, next to the player bar (so the take survives chapter changes).
- Only the last recording is kept, in browser memory; lost on reload. A new recording replaces it.
- Starting a recording pauses the audiobook if it is playing.

**Acceptance**
- Record / Stop buttons record from the microphone (`MediaRecorder`).
- After stopping, the user can play and stop playing own recording.
- Starting a new recording replaces the previous one.
- Starting a recording pauses the audiobook.
- Mic permission denied or no device shows a clear message (no silent failure).
- Recording stops and the mic is released when the user leaves the page.
- The recorder is available in the player bar even when the book has no audio files.
- No backend change, no upload.
- Unit tests with a mocked `MediaRecorder`/`getUserMedia` (no real mic). Manual check in Chrome and Edge.

## S5.2 Recorder hotkeys and playback quality — Story
Found by user in manual test 2026-11-05: no hotkeys; replay of the take sounds bad.

**Decisions (defaults, user may change)**
- Same style as the player bar hotkeys (document-level, ignored in text fields, no key repeat).
- Ctrl+Enter: start / stop recording. Ctrl+ArrowUp: play / stop my recording (only when a take exists and not recording).

**Acceptance**
- The two hotkeys call the same handlers as the buttons.
- Hotkeys are shown (title/aria) on the buttons.
- Replay quality: dev finds the cause (likely mic processing constraints: echo cancellation / noise suppression / auto gain, and low default bitrate) and fixes it: request a good bitrate and a supported mime type (`audio/webm;codecs=opus` with fallback), and turn off mic processing that degrades speech. Keep a safe fallback if constraints are rejected.
- Unit tests with mocks. Manual check: user compares replay quality.

## Later (not planned)
Storing recordings per sentence, practice, A/B compare, sentence loop need sync (Epic 4, skipped). Dropped for now: S5.2-S5.5.
