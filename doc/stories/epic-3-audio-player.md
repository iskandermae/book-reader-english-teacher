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

## S3.3 Remember audio position — Story — DONE
Assumptions (PM defaults, user may change): position is stored in the DB as a field of the audio file row (deleted with the file, no extra cleanup); one position per audio file, not per chapter.

**Acceptance**
- Backend: audio file has `positionSeconds` (default 0, new migration). `PUT /api/books/{id}/audio/{audioId}/position` saves it; rejects negative values and beyond-file-length is not checked. The audio list/get response includes it. `openapi.json` regenerated.
- Player saves the position while playing at most every 5 s, and also on pause, seek, and when leaving the reader page.
- When the player opens a file, it starts at the saved position. If the saved position is within 2 s of the end (or the file ended), it starts from 0.
- Changing the chapter range of a file keeps its position.
- Backend unit tests: save, negative rejected, unknown file 404, position in response. Frontend tests (fake timers): throttled save, save on pause/seek/destroy, restore on load, restart near the end.
- Out of scope: switching audio on chapter change (S3.4), syncing text to audio, position per device.
- Verify: unit tests; browser check (play, reload, position restored).

## S3.4 Switch audio with the chapter — Story — DONE
Decisions (user, 2026-11-03): a different file loads paused; a chapter without audio shows the bar with a "No audio" message.
Assumption: a book with no audio files at all shows no bar (no clutter). Frontend only; S3.2 already picks the file by chapter range.

**Acceptance**
- Opening a chapter covered by the same file as before: playback is not interrupted.
- Opening a chapter covered by a different file: the player loads that file paused, at its saved position (S3.3). It does not start playing, even if the previous file was playing.
- The player bar is recreated per audio file (e.g. `@for` track by file id, or equivalent), because position restore runs once per instance. The previous file's position is saved before the switch.
- Opening a chapter that no file covers, in a book that has audio: the bar stays visible with "No audio for this chapter"; the previous audio stops and its position is saved. Controls are not shown.
- A book with no audio files shows no bar and no message. The reserved bottom space follows the bar (no bar, no space).
- Returning to a covered chapter shows the player again.
- Frontend tests: same file keeps the instance; different file gives a new instance and paused state; no-audio state; no-audio-at-all state; position saved on switch.
- Out of scope: auto-advance to the next chapter at the end of audio, keyboard shortcuts (S3.5).
- Verify: unit tests; browser check with 2 files (chapter ranges 0-1 and 2-3) and a gap chapter.

## S3.5 Hot keys — Story — DONE
Decision (user, 2026-11-03): Ctrl+Left = -10 s, Ctrl+Right = +10 s, Ctrl+Space = play/pause; active whenever the player (with controls) is shown.
Assumptions (PM defaults): keys are ignored while focus is in a text field (input, textarea, select, contenteditable), because Ctrl+arrows edit text there; Ctrl only (no Cmd); frontend only.

**Acceptance**
- While the player bar with controls is shown, Ctrl+Left / Ctrl+Right skip -10 s / +10 s, and Ctrl+Space toggles play/pause. Same behaviour (and position saving) as the existing buttons.
- The browser default for these keys is prevented when handled (no page scroll, no button re-click).
- Keys do nothing when no player is shown (no audio, "No audio" state), when focus is in a text field, or with extra modifiers (Shift, Alt).
- Key auto-repeat on Ctrl+Space does not toggle repeatedly.
- The button tooltips (title) show the shortcut.
- The listener is removed when the player is destroyed (no duplicates after a file switch).
- Frontend tests: each key, ignored in text field, ignored with Shift/Alt, repeat ignored, no player, listener cleanup.
- Out of scope: configurable keys, other shortcuts, Cmd on Mac.
- Verify: unit tests; browser check (keys work, typing in settings/workspace fields is not affected).

## S3.6 Search — Story — DONE
User story: I listen to a phrase in the audiobook, then I want a search text box to find the chapter/paragraph.
Decisions (user, 2026-11-03): search the current book only; match words ignoring case and punctuation; picking a result jumps to the chapter and highlights the paragraph.
Assumptions (PM defaults): a phrase is found only inside one paragraph; the whole paragraph is highlighted (not the words); max 50 results; query shorter than 2 characters is not searched.

**Acceptance**
- Backend: `GET /api/books/{id}/search?q=...` returns matches `{chapterIndex, chapterTitle, paragraphIndex, snippet}` in book order, at most 50, plus a flag if more exist. Unknown book gives 404. Query under 2 characters (after trimming) gives 400 with a clear message.
- Matching: text and query are normalized: case-insensitive, punctuation and extra whitespace ignored, apostrophes inside words dropped (so "don't" and "dont" both match). The query words must appear in the same order, next to each other, inside one paragraph. `openapi.json` regenerated.
- The snippet is a short text around the match (about 100 characters each side, cut at word edges).
- Reader page has a search box. Typing (debounced) or pressing Enter shows the results list: chapter title + snippet; "No results" state; "showing first 50" note when more exist; error message when the search fails.
- Picking a result opens that chapter, scrolls to the paragraph and highlights it. The highlight is cleared when another chapter is opened or the search is cleared.
- Search does not interfere with the audio hot keys (S3.5 already ignores text fields) or the text selection panel.
- Backend unit tests: normalization (case, punctuation, apostrophe, spaces), phrase order, multi-paragraph/chapter results, limit and flag, short query, unknown book. Frontend tests: search box, results, empty/error/limit states, jump + highlight, highlight cleared.
- Out of scope: searching all books, fuzzy matching, search inside audio, highlighting words, full-text index.
- Verify: unit tests; browser check (search a phrase from the book, pick a result, paragraph highlighted).
