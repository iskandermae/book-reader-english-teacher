# Epic 1: Library and Reader (MVP)

Depends on: Epic 0.

## S1.1 Import a .txt book (backend) — Story — DONE
As a reader I can import a `.txt` book through the API so it is stored for reading.
Decisions: one file per book (multi-file is S1.7); title is a request field, the UI prefills it from the filename; importing the same book twice is allowed (no duplicate check).
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

## S1.2 Library API (backend) — Story — DONE
As a reader I can list and delete imported books through the API.
Decisions (defaults, change if you disagree): `Book.LastOpenedAt` is a nullable column added now, set later by S1.5 (null until then). List order: last opened first, then most recently imported. Delete is a hard delete with cascade; the confirmation dialog is UI only (S1.3).
**Acceptance**
- `GET /api/books` returns a list of `{id, title, chapterCount, importedAt, lastOpenedAt}` (no chapter or paragraph text), in the order above. Empty list when no books.
- `DELETE /api/books/{id}` removes the book, its chapters and paragraphs; 204 on success, 404 for an unknown id.
- EF migration adds `LastOpenedAt`. `api/openapi.json` updated (regenerated, not by hand).
- Unit tests (fast, no network): empty list, order, chapter counts, delete cascades to chapters and paragraphs, delete unknown id gives 404. Endpoint tests for both routes.
Verify: dev runs tests.

## S1.3 Library page and upload UI (frontend) — Story — TODO
Depends on S1.2 and S1.1. Library page lists books (title, chapter count, last opened or "never"); upload form (file picker, title field prefilled from filename, clear error messages from the API); delete with confirmation; empty state explains how to import. Needs grooming before implementation.

## S1.4 Reader page — Story — TODO
**Acceptance**
- Chapter list navigation; one chapter rendered as paragraphs.
- Next/previous chapter controls.
- A chapter of 100k+ characters scrolls smoothly (no visible lag).

## S1.5 Remember reading position — Story — TODO
**Acceptance**
- Chapter and paragraph are saved while scrolling (debounced).
- Opening the book from the library resumes at the saved position.

## S1.6 Reader appearance — Story — TODO
**Acceptance**
- Font size, light/dark theme, text column width.
- Settings persist across sessions.

## S1.7 Multi-file book import — Story — TODO
One upload of several `.txt` files, ordered by natural filename sort, merged into one book (D11). Postponed from S1.1.
