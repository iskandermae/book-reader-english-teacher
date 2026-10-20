# Epic 1: Library and Reader (MVP)

Depends on: Epic 0.

## S1.1 Import a .txt book — Story — TODO
As a reader I can upload a `.txt` book so I can read it in the app.
**Acceptance**
- Upload endpoint and UI; UTF-8 and UTF-8 BOM handled, other encodings give a clear error.
- Chapters detected by a configurable regex (default matches "Chapter N" style headings, as in HPMOR).
- A file with no matching headings becomes a single chapter.
- Text is split into paragraphs and stored (book, chapter, paragraph tables).
- Unit tests: HPMOR-style headings, no headings, empty file, very large file.

## S1.2 Library page — Story — TODO
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
