# Epic 3: Audiobook player (R2)

Depends on: Epic 1.

## S3.1 Attach audio files to a book — Story — DONE
Decisions (user, 2026-10-28): audio is copied into the `data` folder; mapping is by chapter range (D11) with From/To chapter pickers.

**Acceptance**
- User uploads one or more audio files (mp3 at least) to a book; each file is copied to the `data` folder.
- Each audio file has a chapter range (From chapter, To chapter), picked from the book's chapter list. Default: the whole book.
- A range can be edited. Overlapping ranges within one book are rejected with a clear message.
- User can remove an audio file (the DB row and the copied file are deleted).
- Deleting a book also deletes its audio files.
- Backend streams audio with HTTP range support (206 responses), so seeking works.
- Unsupported file type or empty file is rejected with a clear message.
- Backend unit tests cover range validation, overlap, delete cleanup, and range requests. Frontend tests cover the attach/edit/remove UI.
- Out of scope: the player (S3.2), position memory (S3.3), loading audio by chapter (S3.4).
- Assumption: file-size limit is raised for audio uploads; value chosen by the dev and reported.

## S3.2 Player bar — Story — DONE
Decisions (user, 2026-10-29): file = the one whose range covers the current chapter; speed remembered in settings; fixed bar at the bottom of the reader page.

**Acceptance**
- Reader page shows a fixed bottom player bar when the opened chapter is covered by an audio file; the text stays scrollable and not hidden behind the bar.
- If no file covers the chapter, or the book has no audio, no player is shown (a clear "no audio" state is S3.4).
- Controls: play/pause, seek bar with current/total time, skip -10 s / +10 s, speed 0.75x / 1x / 1.25x / 1.5x.
- Audio is streamed from the existing `/api/books/{id}/audio/...` endpoint (range requests, seeking works).
- Speed is saved in a setting (`player.speed`, default 1) and restored on next open.
- Frontend tests (player component with a mocked audio element, speed setting load/save). Backend: only the new setting key, if the settings API needs it.
- Out of scope: position memory (S3.3), switching audio on chapter change (S3.4), keyboard shortcuts, recording.
- Verify: unit tests; browser check with a sample mp3 (play, seek, skip, speed, reload keeps speed).

## S3.3 Remember audio position — Story — TODO
**Acceptance**
- Position is saved per audio file (debounced) and restored on reopen.

## S3.4 Switch audio with the chapter — Story — TODO
**Acceptance**
- Navigating to another chapter loads the mapped audio file.
- Chapters without audio show a clear "no audio" state.
