# Epic 1: Library and Reader (MVP)

Depends on: Epic 0.

## S1.1 Import a .txt book (backend) — Story — DONE
As a reader I can import a `.txt` book through the API so it is stored for reading.
Decisions: one file per book (multi-file is S1.6); title is a request field, the UI prefills it from the filename; importing the same book twice is allowed (no duplicate check).
**Acceptance**
- `POST` multipart endpoint: one `.txt` file plus optional `title` (default: filename without extension). Returns book id, title, chapter count. Contract updated in `api/openapi.json`.
- UTF-8 and UTF-8 BOM accepted; other encodings give a clear 400 error. Empty file gives a clear 400 error.
- Chapters detected by a regex setting (default matches "Chapter N" headings, as in HPMOR: `Chapter 1: A Day of Very Low Probability`). Chapter title = the heading line.
- Text before the first heading goes to the first chapter; a file with no matching headings becomes a single chapter.
- Text is split into paragraphs (blank-line separated, whitespace trimmed, empty ones dropped) and stored in book, chapter, paragraph tables (EF migration).
- An invalid regex setting gives a clear error, not a crash.
- Unit tests (fast, no network): HPMOR-style headings, no headings, empty file, BOM, non-UTF-8, text before first heading, ~5 MB generated file imports within a few seconds.
Verify: dev runs tests; `book/1.txt` imports as 1 chapter.
Note: sample `book/1.txt` has only Chapter 1; large-book test uses generated text.

## S1.2 Library page and upload UI — Story — TODO
Includes the upload form (file picker, title field prefilled from filename) calling S1.1.
**Acceptance**
- Page lists books (title, chapter count, last opened).
- A book can be deleted with confirmation; its data is removed.
- Empty state explains how to import.

## S1.3 Reader page — Story — TODO
**Acceptance**
- Chapter list navigation; one chapter rendered as paragraphs.
- Next/previous chapter controls.
- A chapter of 100k+ characters scrolls smoothly (no visible lag).

## S1.4 Remember reading position — Story — TODO
**Acceptance**
- Chapter and paragraph are saved while scrolling (debounced).
- Opening the book from the library resumes at the saved position.

## S1.5 Reader appearance — Story — TODO
**Acceptance**
- Font size, light/dark theme, text column width.
- Settings persist across sessions.

## S1.6 Multi-file book import — Story — TODO
One upload of several `.txt` files, ordered by natural filename sort, merged into one book (D11). Postponed from S1.1.
