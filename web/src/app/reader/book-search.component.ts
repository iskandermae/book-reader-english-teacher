import { Component, inject, input, output, signal } from '@angular/core';
import { reportError } from '../report-error';
import { ReaderService, SearchMatch, SearchResult } from './reader.service';

const MIN_QUERY_LENGTH = 2; // the backend rejects shorter queries
const TYPING_DELAY_MS = 400;

/** Search box with a results list; picking a result is reported to the reader, which owns navigation. */
@Component({
  selector: 'app-book-search',
  // Up to 50 results must not push the text down: the list floats over it and scrolls inside its own box.
  styles: `:host { display: block; position: relative; } input { width: 100%; box-sizing: border-box; }
    .results { position: absolute; left: 0; right: 0; top: 100%; max-height: 50vh; overflow-y: auto; background: Canvas;
               color: CanvasText; border: 1px solid GrayText; padding: 0.25rem 0.5rem; }
    .results p { margin: 0.25rem 0; } ul { margin: 0; padding-left: 1rem; }`,
  template: `
    <input type="search" aria-label="Search the book" placeholder="Search the book" [value]="query()"
           (input)="typed($any($event.target).value)" (keydown.enter)="searchNow()" />
    @if (error() || result()) {
    <div class="results">
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    } @else if (result(); as r) {
      @if (r.matches.length === 0) {
        <p role="status">No results</p>
      } @else {
        <ul>
          @for (m of r.matches; track $index) {
            <li>
              <button type="button" (click)="picked.emit(m)">
                <strong>{{ m.chapterTitle }}</strong> {{ m.snippet }}
              </button>
            </li>
          }
        </ul>
        @if (r.hasMore) {
          <p role="status">Showing first {{ r.matches.length }} results</p>
        }
      }
    }
    </div>
    }
  `,
})
export class BookSearchComponent {
  private readonly api = inject(ReaderService);
  readonly bookId = input.required<number>();
  readonly picked = output<SearchMatch>();
  /** The box was emptied: the reader drops the paragraph highlight. */
  readonly cleared = output<void>();

  protected readonly query = signal('');
  protected readonly result = signal<SearchResult | null>(null);
  protected readonly error = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;
  // Guards against a slow earlier response overwriting a newer one.
  private token = 0;

  protected typed(value: string): void {
    this.query.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.searchNow(), TYPING_DELAY_MS);
  }

  protected async searchNow(): Promise<void> {
    clearTimeout(this.timer);
    const token = ++this.token;
    const text = this.query().trim();
    this.error.set('');
    if (text.length < MIN_QUERY_LENGTH) {
      this.result.set(null);
      if (!text) this.cleared.emit();
      return;
    }
    try {
      const result = await this.api.search(this.bookId(), text);
      if (token === this.token) this.result.set(result);
    } catch (e) {
      if (token !== this.token) return;
      this.result.set(null);
      this.error.set(reportError('Search failed.', e));
    }
  }
}
