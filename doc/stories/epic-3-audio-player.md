# Epic 3: Audiobook player (R2)

Depends on: Epic 1.

## S3.1 Attach audio files to a book — Story — TODO
**Acceptance**
- User picks local audio file(s) for a book and maps each to a chapter (or one file to the whole book).
- Files are referenced or copied to app storage (decision recorded in the PR).
- Backend streams audio with HTTP range support, so seeking works.

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
