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

## S3.2 Player bar — Story — TODO
**Acceptance**
- Play/pause, seek bar, skip ±10 s, speed 0.75x-1.5x.
- Player stays visible while reading.

## S3.3 Remember audio position — Story — TODO
**Acceptance**
- Position is saved per audio file (debounced) and restored on reopen.

## S3.4 Switch audio with the chapter — Story — TODO
**Acceptance**
- Navigating to another chapter loads the mapped audio file.
- Chapters without audio show a clear "no audio" state.
