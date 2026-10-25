import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BookChapters, Chapter, ReaderService } from './reader.service';

@Component({
  selector: 'app-reader',
  imports: [RouterLink],
  styles: `
    .layout { display: flex; gap: 1rem; align-items: flex-start; }
    nav { min-width: 14rem; max-width: 18rem; }
    nav button.current { font-weight: bold; }
    article { flex: 1; }
    /* A chapter is rendered whole; the browser skips layout/paint of off-screen paragraphs. */
    article p { content-visibility: auto; contain-intrinsic-size: auto 5rem; }
  `,
  template: `
    <a routerLink="/">Back to library</a>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    } @else if (!book()) {
      <p>Loading...</p>
    } @else {
      <h1>{{ book()!.title }}</h1>
      <button type="button" (click)="panelOpen.set(!panelOpen())">Chapters</button>
      <div class="layout">
        @if (panelOpen()) {
          <nav>
            @for (c of book()!.chapters; track c.index) {
              <div>
                <button type="button" [class.current]="c.index === chapterIndex()" (click)="open(c.index)">
                  {{ c.title }}
                </button>
              </div>
            }
          </nav>
        }
        <article>
          @if (chapter(); as chapter) {
          <h2>{{ chapter.title }}</h2>
          <button type="button" [disabled]="chapterIndex() <= 0" (click)="open(chapterIndex() - 1)">Previous</button>
          <button type="button" [disabled]="chapterIndex() >= lastIndex()" (click)="open(chapterIndex() + 1)">
            Next
          </button>
          @for (p of chapter.paragraphs; track $index) {
            <p>{{ p }}</p>
          }
          } @else {
            <p>Loading...</p>
          }
        </article>
      </div>
    }
  `,
})
export class ReaderComponent {
  private readonly api = inject(ReaderService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly bookId = toSignal(this.route.paramMap.pipe(map((p) => Number(p.get('id')))), { requireSync: true });
  // Zero-based; a missing or invalid query value means the first chapter.
  protected readonly chapterIndex = toSignal(
    this.route.queryParamMap.pipe(map((p) => Math.max(0, Math.trunc(Number(p.get('chapter'))) || 0))),
    { requireSync: true },
  );

  protected readonly book = signal<BookChapters | null>(null);
  protected readonly chapter = signal<Chapter | null>(null);
  protected readonly error = signal('');
  protected readonly lastIndex = computed(() => (this.book()?.chapters.length ?? 1) - 1);
  // Closed by default on narrow screens (matchMedia is missing in some test environments).
  protected readonly panelOpen = signal(window.matchMedia?.('(min-width: 800px)').matches ?? true);

  // Guards against a slow earlier response overwriting a newer one.
  private loadToken = 0;
  private loadedBookId: number | null = null;

  constructor() {
    effect(() => void this.load(this.bookId(), this.chapterIndex()));
  }

  protected open(index: number): void {
    void this.router.navigate([], { queryParams: { chapter: index }, queryParamsHandling: 'merge' });
  }

  private async load(bookId: number, index: number): Promise<void> {
    const token = ++this.loadToken;
    this.error.set('');
    this.chapter.set(null);
    try {
      // The chapter list is only fetched when the book changes, not on every chapter switch.
      if (this.loadedBookId !== bookId) {
        this.book.set(null);
        const book = await this.api.chapters(bookId);
        if (token !== this.loadToken) return;
        this.book.set(book);
        this.loadedBookId = bookId;
      }
      const chapter = await this.api.chapter(bookId, index);
      if (token !== this.loadToken) return;
      this.chapter.set(chapter);
      window.scrollTo(0, 0);
    } catch {
      if (token !== this.loadToken) return;
      this.loadedBookId = null;
      this.error.set('Could not load this book or chapter.');
    }
  }
}
