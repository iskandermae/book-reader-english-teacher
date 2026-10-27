import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, inject, Injector, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { APPEARANCE_OPTIONS, AppearanceKey, AppearanceService } from '../appearance/appearance.service';
import { captureSelection, TextSelection } from './capture-selection';
import { WorkspaceComponent } from './workspace.component';
import { BookChapters, Chapter, ReaderService, ReadingPosition } from './reader.service';

const SAVE_DELAY_MS = 1000;
const SELECTION_DELAY_MS = 150;

@Component({
  selector: 'app-reader',
  imports: [RouterLink, WorkspaceComponent],
  styles: `
    .layout { display: flex; gap: 1rem; align-items: flex-start; }
    nav { min-width: 14rem; max-width: 18rem; }
    nav button.current { font-weight: bold; }
    article { margin: 0 auto; font-size: var(--reader-font-size, 1rem); max-width: var(--reader-width, 45rem); }
    /* Appearance is two attributes on <article>; paragraphs only inherit, so a long chapter costs nothing extra. */
    article[data-font=small] { --reader-font-size: 0.875rem; }
    article[data-font=large] { --reader-font-size: 1.25rem; }
    article[data-font=xlarge] { --reader-font-size: 1.5rem; }
    article[data-width=narrow] { --reader-width: 32rem; }
    article[data-width=wide] { --reader-width: 60rem; }
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
      <fieldset>
        <legend>Appearance</legend>
        @for (c of controls; track c.key) {
          <label>{{ c.label }}
            <select [attr.name]="c.key" (change)="choose(c.key, $any($event.target).value)">
              @for (o of c.options; track o) {
                <option [value]="o" [selected]="appearance.values()[c.key] === o">{{ o }}</option>
              }
            </select>
          </label>
        }
      </fieldset>
      @if (appearance.saveError()) {
        <p role="alert">{{ appearance.saveError() }}</p>
      }
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
        <app-workspace [selection]="selection()" [resetKey]="chapter()">
        <article [attr.data-font]="appearance.values()['reader.fontSize']" [attr.data-width]="appearance.values()['reader.width']">
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
        </app-workspace>
      </div>
    }
  `,
})
export class ReaderComponent {
  private readonly api = inject(ReaderService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly appearance = inject(AppearanceService);
  protected readonly controls = [
    { key: 'reader.fontSize', label: 'Font size' },
    { key: 'reader.theme', label: 'Theme' },
    { key: 'reader.width', label: 'Width' },
  ].map((c) => ({ ...c, key: c.key as AppearanceKey, options: APPEARANCE_OPTIONS[c.key as AppearanceKey] }));

  private readonly injector = inject(Injector);
  private readonly host = inject(ElementRef<HTMLElement>);

  private readonly bookId = toSignal(this.route.paramMap.pipe(map((p) => Number(p.get('id')))), { requireSync: true });
  // Zero-based; null when the URL has no ?chapter, which means "resume where I stopped".
  // An invalid value means the first chapter.
  private readonly requestedChapter = toSignal(
    this.route.queryParamMap.pipe(
      map((p) => (p.has('chapter') ? Math.max(0, Math.trunc(Number(p.get('chapter'))) || 0) : null)),
    ),
    { requireSync: true },
  );
  // The chapter actually shown (differs from the URL when resuming).
  protected readonly chapterIndex = signal(0);

  protected readonly book = signal<BookChapters | null>(null);
  protected readonly chapter = signal<Chapter | null>(null);
  protected readonly error = signal('');
  protected readonly lastIndex = computed(() => (this.book()?.chapters.length ?? 1) - 1);
  // Closed by default on narrow screens (matchMedia is missing in some test environments).
  protected readonly panelOpen = signal(window.matchMedia?.('(min-width: 800px)').matches ?? true);

  // The text currently selected inside the chapter; null when nothing usable is selected.
  protected readonly selection = signal<TextSelection | null>(null);
  private selectionTimer: ReturnType<typeof setTimeout> | undefined;

  // Guards against a slow earlier response overwriting a newer one.
  private loadToken = 0;
  private loadedBookId: number | null = null;

  // Reading position tracking: paragraphs currently on screen, the pending debounced save and the last saved value.
  private observer: IntersectionObserver | null = null;
  private readonly visible = new Set<number>();
  private currentParagraph = 0;
  private pending: { bookId: number; position: ReadingPosition } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastSaved: ReadingPosition | null = null;

  constructor() {
    effect(() => void this.load(this.bookId(), this.requestedChapter()));
    // selectionchange fires on every Shift+arrow press, so the work is debounced.
    const onSelectionChange = () => {
      clearTimeout(this.selectionTimer);
      this.selectionTimer = setTimeout(() => this.updateSelection(), SELECTION_DELAY_MS);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('selectionchange', onSelectionChange);
      clearTimeout(this.selectionTimer);
      // Invalidate any in-flight load so it cannot save or start observing after destroy.
      this.loadToken++;
      this.stopObserving();
      this.flush();
    });
  }

  protected choose(key: AppearanceKey, value: string): void {
    void this.appearance.set(key, value);
  }

  protected open(index: number): void {
    void this.router.navigate([], { queryParams: { chapter: index }, queryParamsHandling: 'merge' });
  }

  private updateSelection(): void {
    const article = this.host.nativeElement.querySelector('article');
    const sel = window.getSelection();
    const captured = article && captureSelection(sel, article);
    this.selection.set(captured || null);
  }

  private async load(bookId: number, requested: number | null): Promise<void> {
    const token = ++this.loadToken;
    this.error.set('');
    this.chapter.set(null);
    this.selection.set(null);
    this.stopObserving();
    // A pending save of the previous chapter is superseded by this load; another book's save must still go out.
    if (this.pending && this.pending.bookId !== bookId) this.flush();
    else this.cancelPending();
    try {
      // The chapter list is only fetched when the book changes, not on every chapter switch.
      if (this.loadedBookId !== bookId) {
        this.book.set(null);
        this.lastSaved = null;
        const book = await this.api.chapters(bookId);
        if (token !== this.loadToken) return;
        this.book.set(book);
        this.loadedBookId = bookId;
      }
      // Without ?chapter, resume at the saved position; a failed or invalid one falls back to the top of chapter 0.
      let start: ReadingPosition = { chapterIndex: requested ?? 0, paragraphIndex: 0 };
      let resuming = false;
      if (requested === null) {
        start = await this.api.position(bookId).catch(() => start);
        if (token !== this.loadToken) return;
        resuming = true;
      }
      let chapter: Chapter;
      try {
        chapter = await this.api.chapter(bookId, start.chapterIndex);
      } catch (e) {
        if (!resuming || start.chapterIndex === 0) throw e;
        start = { chapterIndex: 0, paragraphIndex: 0 };
        chapter = await this.api.chapter(bookId, 0);
      }
      if (token !== this.loadToken) return;
      this.chapterIndex.set(start.chapterIndex);
      this.chapter.set(chapter);
      // An explicit chapter change is saved at once (paragraph 0); a resume is already saved.
      if (resuming) this.lastSaved = start;
      else this.save(bookId, { chapterIndex: start.chapterIndex, paragraphIndex: 0 });
      afterNextRender(
        () => {
          if (token === this.loadToken) this.startObserving(bookId, start);
        },
        { injector: this.injector },
      );
    } catch {
      if (token !== this.loadToken) return;
      this.loadedBookId = null;
      this.error.set('Could not load this book or chapter.');
    }
  }

  /** Scrolls to the paragraph and then watches which paragraph is at the top of the viewport. */
  private startObserving(bookId: number, start: ReadingPosition): void {
    const paragraphs = Array.from<HTMLElement>(this.host.nativeElement.querySelectorAll('article p'));
    this.stopObserving();
    // A saved paragraph beyond the chapter's end (e.g. the book changed) means the top.
    const target = start.paragraphIndex < paragraphs.length ? start.paragraphIndex : 0;
    if (target > 0) paragraphs[target].scrollIntoView();
    else window.scrollTo(0, 0);
    this.currentParagraph = target;
    this.visible.clear();
    // The first paragraph that intersects the viewport is the first one whose bottom is below its top.
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const index = paragraphs.indexOf(entry.target as HTMLElement);
        if (entry.isIntersecting) this.visible.add(index);
        else this.visible.delete(index);
      }
      if (this.visible.size === 0) return;
      const first = Math.min(...this.visible);
      if (first === this.currentParagraph) return;
      this.currentParagraph = first;
      this.schedule(bookId, { chapterIndex: this.chapterIndex(), paragraphIndex: first });
    });
    paragraphs.forEach((p) => this.observer!.observe(p));
  }

  private stopObserving(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private schedule(bookId: number, position: ReadingPosition): void {
    this.pending = { bookId, position };
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  private cancelPending(): void {
    clearTimeout(this.timer);
    this.pending = null;
  }

  private flush(): void {
    const pending = this.pending;
    this.cancelPending();
    if (pending) this.save(pending.bookId, pending.position);
  }

  private save(bookId: number, position: ReadingPosition): void {
    const last = this.lastSaved;
    if (last && last.chapterIndex === position.chapterIndex && last.paragraphIndex === position.paragraphIndex) return;
    // A failed save is silent; the next position change tries again.
    this.api.savePosition(bookId, position).then(
      () => (this.lastSaved = position),
      () => undefined,
    );
  }
}
