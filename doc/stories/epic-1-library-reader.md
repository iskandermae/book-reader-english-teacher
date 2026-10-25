# Epic 1: Library and Reader (MVP)

Depends on: Epic 0.

## S1.1 Import a .txt book (backend) — Story — DONE
As a reader I can import a `.txt` book through the API so it is stored for reading.
Decisions: one file per book (multi-file is S1.8); title is a request field, the UI prefills it from the filename; importing the same book twice is allowed (no duplicate check).
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
Decisions (defaults, change if you disagree): `Book.LastOpenedAt` is a nullable column added now, set later by S1.6 (null until then). List order: last opened first, then most recently imported. Delete is a hard delete with cascade; the confirmation dialog is UI only (S1.3).
**Acceptance**
- `GET /api/books` returns a list of `{id, title, chapterCount, importedAt, lastOpenedAt}` (no chapter or paragraph text), in the order above. Empty list when no books.
- `DELETE /api/books/{id}` removes the book, its chapters and paragraphs; 204 on success, 404 for an unknown id.
- EF migration adds `LastOpenedAt`. `api/openapi.json` updated (regenerated, not by hand).
- Unit tests (fast, no network): empty list, order, chapter counts, delete cascades to chapters and paragraphs, delete unknown id gives 404. Endpoint tests for both routes.
Verify: dev runs tests.

## S1.3 Library page and upload UI (frontend) — Story — DONE
As a reader I see my books, can import a `.txt` file, and can delete a book.
Depends on S1.1 and S1.2 (API already done). Uses only the generated client; no backend changes.
Decisions (defaults, change if you disagree): the library replaces the home page at `/` (the "API OK" health check goes away; a failed list load shows an error message instead). Plain Angular, no UI library. Delete confirmation is inline (Delete → "Delete? Yes / No" on the row), not a browser `confirm()`. Book titles are plain text for now; S1.5 turns them into links to the reader. After a successful upload the list refreshes and the form resets.
**Acceptance**
- Route `/` shows the library: a list of books with title, chapter count, last opened (formatted date, or "never"). A link to Settings stays reachable.
- Empty state: short text explaining how to import (choose a `.txt` file, optional title, press Import).
- Upload form: file picker limited to `.txt`; title field prefilled from the chosen file name without extension and editable; Import button disabled until a file is chosen and while uploading.
- API errors from import (400 ProblemDetails) show the `detail` text next to the form. Generic message if there is no detail.
- Delete: row action asks inline confirmation; Yes calls `DELETE`, then removes the row; No cancels. A failed delete shows an error.
- Loading and list-load-error states are visible.
- Unit tests (Vitest via `ng test`, no network, generated client mocked): empty state, list rendering incl. "never", title prefill, import success refreshes list, import error shows detail, delete confirm/cancel/success. The old home spec and health service are removed with the page.
Verify: dev runs `npm test -- --watch=false` and `npm run build`; QA reads the code.

## S1.4 Reader API (backend) — Story — DONE
As a reader I can get a book's chapter list and one chapter's text through the API.
Decisions (defaults, change if you disagree): chapters are addressed by their zero-based `index`. A chapter is returned whole in one response (no paging); a 100k-character chapter is about 100 KB of JSON, which is fine locally, and the UI (S1.5) is responsible for smooth rendering. Paragraphs are returned as an ordered array of strings; the array position is the paragraph index used by S1.6. These endpoints do not touch `LastOpenedAt` (S1.6 does).
**Acceptance**
- `GET /api/books/{id}/chapters` returns `{bookId, title, chapters:[{index, title, paragraphCount}]}` ordered by index; 404 for an unknown book.
- `GET /api/books/{id}/chapters/{index}` returns `{bookId, index, title, paragraphs:[string]}` in paragraph order; 404 for an unknown book or chapter index. Chapter list loads without reading paragraph text.
- `api/openapi.json` updated (regenerated, not by hand).
- Unit tests (fast, no network): chapter list order and counts, chapter text order, unknown book (both routes), unknown chapter index, a generated 100k+ character chapter returns all paragraphs. Endpoint tests for both routes.
Verify: dev runs tests.

## S1.5 Reader page (frontend) — Story — DONE
As a reader I can open a book from the library and read it chapter by chapter.
Depends on S1.4 (API done). Uses only the generated client; no backend changes.
Decisions (defaults, change if you disagree): route `/books/:id` (optional query `?chapter=N`, zero-based, default 0); library titles become links to it. Plain Angular, no UI library. A chapter is rendered whole as `<p>` elements; smoothness comes from CSS `content-visibility: auto` with `contain-intrinsic-size` on paragraphs (no virtual-scroll library). Changing chapter scrolls to the top. Chapter list is a collapsible side panel (closed by default on narrow screens). Position saving is S1.6b; appearance is S1.7.
**Acceptance**
- Library book titles link to `/books/:id`. Reader has a "Back to library" link.
- Reader loads the chapter list and chapter 0 (or `?chapter=N`); shows book title, chapter title, paragraphs in order.
- Chapter list panel: all chapters by title, current one highlighted, click opens it and updates the URL query.
- Previous / Next buttons; Previous disabled on first chapter, Next disabled on last. Single-chapter book works.
- Unknown book or chapter (404) and other load failures show an error message with a link back to the library; loading state visible.
- A 100k+ character chapter (about 1000 paragraphs) uses the paragraph CSS above so it scrolls without lag.
- Unit tests (Vitest, generated client mocked, no network): renders paragraphs, chapter list highlight and click, next/prev incl. disabled states, `?chapter=N`, 404 error, library link.
Verify: dev runs `npm test -- --watch=false` and `npm run build`; QA reads the code.

## S1.6 Reading position API (backend) — Story — DONE
As a reader the app stores where I stopped in each book.
Decisions (defaults, change if you disagree): position = zero-based chapter index and paragraph index (array position from S1.4). Stored as nullable columns on `Book`. A book with no saved position reads as chapter 0, paragraph 0. Saving a position also sets `LastOpenedAt` (so library order "last opened first" works). Out-of-range values give 400 (not clamped).
**Acceptance**
- `PUT /api/books/{id}/position` body `{chapterIndex, paragraphIndex}`: saves it and sets `LastOpenedAt` to now; 204. 404 unknown book; 400 if the chapter does not exist, or paragraph index is negative or >= that chapter's paragraph count.
- `GET /api/books/{id}/position` returns `{chapterIndex, paragraphIndex}`; `{0,0}` when nothing saved; 404 unknown book. It does not change `LastOpenedAt`.
- Deleting a book (S1.2) still works. EF migration adds the columns. `api/openapi.json` regenerated, not by hand.
- Unit tests (fast, no network): default 0/0, save then read back, `LastOpenedAt` set and visible in the book list order, unknown book (both routes), bad chapter, bad paragraph (negative and too large). Endpoint tests for both routes.
Verify: dev runs tests.

## S1.6b Resume reading position (frontend) — Story — DONE
As a reader the book opens where I stopped, and my place is saved as I read.
Depends on S1.5 and S1.6.
Decisions (defaults, change if you disagree): current paragraph = the first paragraph whose bottom is below the top of the viewport, found with IntersectionObserver (no scroll-event math). Save is debounced (1 s) and also sent when leaving the page or changing chapter. Failed save is silent (retried on the next change). Without `?chapter=N` the reader opens at the saved position; with it, chapter N from the top.
**Acceptance**
- On open (no `?chapter`) the reader calls `GET position`, loads that chapter and scrolls to that paragraph.
- Scrolling saves `{chapterIndex, paragraphIndex}` via `PUT` after 1 s of no change (debounced); a burst of scrolling gives one call.
- Changing chapter saves immediately (paragraph 0). Leaving the page flushes a pending save.
- If the saved position is no longer valid (400/404 on load) the reader falls back to chapter 0 top without an error.
- Unit tests (Vitest, client mocked, fake timers): resume at saved paragraph, debounce gives one call, chapter change saves, flush on destroy, `?chapter` overrides saved position.
Verify: dev runs `npm test -- --watch=false` and `npm run build`; QA reads the code.

## S1.7 Reader appearance — Story — TODO
**Acceptance**
- Font size, light/dark theme, text column width.
- Settings persist across sessions.

## S1.8 Multi-file book import — Story — TODO
One upload of several `.txt` files, ordered by natural filename sort, merged into one book (D11). Postponed from S1.1.
