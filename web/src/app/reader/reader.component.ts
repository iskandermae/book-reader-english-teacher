import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { APPEARANCE_OPTIONS, AppearanceKey, AppearanceService } from '../appearance/appearance.service';
import { AudioFile, AudioService } from '../audio/audio.service';
import { PlayerBarComponent } from '../player/player-bar.component';
import { RecorderComponent } from '../player/recorder.component';
import { captureSelection, TextSelection } from './capture-selection';
import { WorkspaceComponent } from './workspace.component';
import { BookSearchComponent } from './book-search.component';
import { BookChapters, Chapter, ReaderService, ReadingPosition } from './reader.service';
import { reportError } from '../report-error';

const SAVE_DELAY_MS = 1000;
const SELECTION_DELAY_MS = 150;

@Component({
  selector: 'app-reader',
  imports: [RouterLink, WorkspaceComponent, PlayerBarComponent, RecorderComponent, BookSearchComponent],
  styles: `
    .layout { display: flex; gap: 1rem; align-items: flex-start; }
    /* Room for the fixed bottom bar, so the end of the text is not hidden behind it. */
    .layout { --player-space: 6rem; padding-bottom: var(--player-space); }
    /* Always shown (at least the recorder). The recorder sits outside the player @for, so a chapter or file change
       does not destroy it and the last take survives. */
    .bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; display: flex; flex-wrap: wrap; gap: 0.5rem;
                  align-items: center; padding: 0.5rem 1rem; background: Canvas; color: CanvasText; border-top: 1px solid GrayText; }
    .no-audio { flex: 1; margin: 0; }
    app-recorder { margin-left: auto; }
    /* Stays at the top while the text scrolls; the results list opens over the text. */
    .tools { position: sticky; top: 0; z-index: 11; background: Canvas; color: CanvasText; padding: 0.25rem 0; display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
    .tools app-book-search { flex: 0 1 22rem; min-width: 12rem; }
    .tools fieldset { margin: 0; padding: 0.25rem 0.5rem; display: flex; gap: 0.75rem; flex-wrap: wrap; }
    nav { min-width: 14rem; max-width: 18rem; }
    nav button { width: 100%; text-align: left; }
    nav button.current { font-weight: bold; }
    article { margin: 0 auto; font-size: var(--reader-font-size, 1rem); max-width: var(--reader-width, 45rem); }
    /* Appearance is two attributes on <article>; paragraphs only inherit, so a long chapter costs nothing extra. */
    article[data-font=small] { --reader-font-size: 0.875rem; }
    article[data-font=large] { --reader-font-size: 1.25rem; }
    article[data-font=xlarge] { --reader-font-size: 1.5rem; }
    article[data-width=narrow] { --reader-width: 32rem; }
    article[data-width=wide] { --reader-width: 60rem; }
    /* A chapter is rendered whole; the browser skips layout/paint of off-screen paragraphs. */
    article p.search-hit { background: Mark; color: MarkText; }
    article p { content-visibility: auto; contain-intrinsic-size: auto 5rem; }
    /* While a search hit is shown, paragraphs are laid out with their real height. With the 5rem estimates the
       paragraphs above the hit change size after the jump and the hit drifts out of view. */
    article.has-hit p { content-visibility: visible; }
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
      <div class="tools">
      <app-book-search [bookId]="bookId()" (picked)="jumpTo($event)" (cleared)="highlight.set(null)" />
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
      </div>
      @if (positionError()) {
        <p role="alert">{{ positionError() }}</p>
      }
      @if (appearance.saveError()) {
        <p role="alert">{{ appearance.saveError() }}</p>
      }
      @if (audioError()) {
        <p role="alert">{{ audioError() }}</p>
      }
      <div class="layout">
        @if (panelOpen()) {
          <nav>
            @for (c of book()!.chapters; track c.index) {
              <div>
                <button type="button" [class.current]="c.index === chapterIndex()" (click)="open(c.index)" [attr.title]="c.title">
                  {{ shortTitle(c.title) }}
                </button>
              </div>
            }
          </nav>
        }
        <app-workspace [selection]="selection()" [resetKey]="chapter()">
        <article [class.has-hit]="hasHit()" [attr.data-font]="appearance.values()['reader.fontSize']" [attr.data-width]="appearance.values()['reader.width']">
          @if (chapter(); as chapter) {
          <h2>{{ chapter.title }}</h2>
          <button type="button" [disabled]="chapterIndex() <= 0" (click)="open(chapterIndex() - 1)">Previous</button>
          <button type="button" [disabled]="chapterIndex() >= lastIndex()" (click)="open(chapterIndex() + 1)">
            Next
          </button>
          @for (p of chapter.paragraphs; track $index) {
            <p [class.search-hit]="isHit($index)">{{ p }}</p>
          }
          } @else {
            <p>Loading...</p>
          }
        </article>
        </app-workspace>
      </div>
      <div class="bottom-bar">
        <!-- Tracked by file id: a new file gets a new player (it saves the old position and restores the new one). -->
        @for (file of playerFiles(); track file.id) {
          <app-player-bar [src]="audio.contentUrl(bookId(), file.id)" [bookId]="bookId()" [audioId]="file.id"
                          [startPosition]="file.positionSeconds" />
        } @empty {
          @if (hasAudio()) {
            <p class="no-audio" role="status">No audio for this chapter</p>
          }
        }
        <app-recorder (started)="player()?.pause()" />
      </div>
    }
  `,
})
export class ReaderComponent {
  private readonly api = inject(ReaderService);
  protected readonly audio = inject(AudioService);
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

  protected readonly bookId = toSignal(this.route.paramMap.pipe(map((p) => Number(p.get('id')))), { requireSync: true });
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
  protected readonly audioError = signal(''); // a failed audio list; the book stays readable without the player
  private readonly audioFiles = signal<AudioFile[]>([]);
  // The file whose chapter range covers the open chapter (ranges never overlap); none means no player.
  private readonly audioFile = computed(() =>
    this.audioFiles().find((a) => a.fromChapter <= this.chapterIndex() && this.chapterIndex() <= a.toChapter) ?? null);
  // Zero or one file, as a list so the template can track the player by file id.
  protected readonly playerFiles = computed(() => {
    const file = this.audioFile();
    return file ? [file] : [];
  });
  protected readonly player = viewChild(PlayerBarComponent);
  // "No audio for this chapter" shows only when the book has audio elsewhere.
  protected readonly hasAudio = computed(() => this.audioFiles().length > 0);
  protected readonly positionError = signal(''); // a failed save of the reading position; the book stays readable
  protected readonly lastIndex = computed(() => (this.book()?.chapters.length ?? 1) - 1);
  // Closed by default on narrow screens (matchMedia is missing in some test environments).
  protected readonly panelOpen = signal(window.matchMedia?.('(min-width: 800px)').matches ?? true);

  // The paragraph picked in the search results; shown highlighted while its chapter is open.
  protected readonly highlight = signal<ReadingPosition | null>(null);

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

  /** Long titles are cut so all chapter buttons stay one width; the full title is in the tooltip. */
  protected shortTitle(title: string): string {
    return title.length > 38 ? title.slice(0, 37).trimEnd() + '…' : title;
  }

  protected open(index: number): void {
    void this.router.navigate([], { queryParams: { chapter: index }, queryParamsHandling: 'merge' });
  }

  protected readonly hasHit = computed(() => this.highlight()?.chapterIndex === this.chapterIndex());

  protected isHit(paragraphIndex: number): boolean {
    return this.hasHit() && this.highlight()!.paragraphIndex === paragraphIndex;
  }

  protected jumpTo(target: ReadingPosition): void {
    this.highlight.set({ chapterIndex: target.chapterIndex, paragraphIndex: target.paragraphIndex });
    if (target.chapterIndex !== this.chapterIndex()) {
      this.open(target.chapterIndex); // load() scrolls to the highlighted paragraph once the chapter is shown
      return;
    }
    // Scroll after the render that removes content-visibility, so the position is computed with real heights.
    afterNextRender(
      () => this.host.nativeElement.querySelectorAll('article p')[target.paragraphIndex]?.scrollIntoView({ block: 'center' }),
      { injector: this.injector },
    );
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
        void this.loadAudio(bookId);
      }
      // Without ?chapter, resume at the saved position; a failed or invalid one falls back to the top of chapter 0.
      const hit = this.highlight();
      const chapterIndex = requested ?? 0;
      let start: ReadingPosition = { chapterIndex, paragraphIndex: hit?.chapterIndex === chapterIndex ? hit.paragraphIndex : 0 };
      let resuming = false;
      if (requested === null) {
        start = await this.api.position(bookId).catch((e) => {
          this.positionError.set(reportError('Could not restore your reading position; starting from the beginning.', e));
          return start;
        });
        if (token !== this.loadToken) return;
        resuming = true;
      }
      let chapter: Chapter;
      try {
        chapter = await this.api.chapter(bookId, start.chapterIndex);
      } catch (e) {
        if (!resuming || start.chapterIndex === 0) throw e;
        this.positionError.set(reportError('Could not restore your reading position; starting from the beginning.', e));
        start = { chapterIndex: 0, paragraphIndex: 0 };
        chapter = await this.api.chapter(bookId, 0);
      }
      if (token !== this.loadToken) return;
      this.chapterIndex.set(start.chapterIndex);
      // Opening any other chapter drops the highlight.
      if (this.highlight()?.chapterIndex !== start.chapterIndex) this.highlight.set(null);
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
    } catch (e) {
      if (token !== this.loadToken) return;
      this.loadedBookId = null;
      this.error.set(reportError('Could not load this book or chapter.', e));
    }
  }

  // Guarded by the book (not the load token): a chapter switch must not discard the list.
  private async loadAudio(bookId: number): Promise<void> {
    this.audioFiles.set([]);
    this.audioError.set('');
    try {
      const files = await this.audio.list(bookId);
      if (this.bookId() === bookId) this.audioFiles.set(files);
    } catch (e) {
      if (this.bookId() === bookId) this.audioError.set(reportError('Could not load the audio files of this book.', e));
    }
  }

  /** Scrolls to the paragraph and then watches which paragraph is at the top of the viewport. */
  private startObserving(bookId: number, start: ReadingPosition): void {
    const paragraphs = Array.from<HTMLElement>(this.host.nativeElement.querySelectorAll('article p'));
    this.stopObserving();
    // A saved paragraph beyond the chapter's end (e.g. the book changed) means the top.
    const target = start.paragraphIndex < paragraphs.length ? start.paragraphIndex : 0;
    if (this.isHit(target)) paragraphs[target].scrollIntoView({ block: 'center' });
    else if (target > 0) paragraphs[target].scrollIntoView();
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
    // A failed save is shown; the next position change tries again.
    this.api.savePosition(bookId, position).then(
      () => {
        this.lastSaved = position;
        this.positionError.set('');
      },
      (e) => this.positionError.set(reportError('Could not save your reading position.', e)),
    );
  }
}
