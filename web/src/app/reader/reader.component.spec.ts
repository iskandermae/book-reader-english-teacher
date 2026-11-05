import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ReaderComponent } from './reader.component';
import { Chapter, ReaderService } from './reader.service';
import { By } from '@angular/platform-browser';
import { AudioService } from '../audio/audio.service';
import { RecorderComponent } from '../player/recorder.component';
import { PlayerBarComponent } from '../player/player-bar.component';
import { SettingsService } from '../settings/settings.service';

const chapters = [0, 1, 2].map((index) => ({ index, title: `Chapter ${index}` }));

/** jsdom has no IntersectionObserver; tests drive it by hand. */
class FakeObserver {
  static instances: FakeObserver[] = [];
  observed: Element[] = [];
  constructor(private readonly callback: (entries: IntersectionObserverEntry[]) => void) {
    FakeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.observed = [];
  }
  /** Reports the paragraph at `index` as entering (or leaving) the viewport. */
  report(index: number, isIntersecting = true) {
    this.callback([{ target: this.observed[index], isIntersecting } as IntersectionObserverEntry]);
  }
}

describe('ReaderComponent', () => {
  // Failures are logged on purpose; keep the test output clean and let tests assert on it.
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => consoleError.mockRestore());

  type Mock = ReturnType<typeof vi.fn>;
  let api: { chapters: Mock; chapter: Mock; position: Mock; savePosition: Mock; search: Mock };
  let settings: { load: Mock; save: Mock };
  let audio: { list: Mock; contentUrl: Mock; savePosition: Mock };
  const observer = () => FakeObserver.instances[FakeObserver.instances.length - 1];

  beforeEach(() => {
    // jsdom does not implement scrolling.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Element.prototype.scrollIntoView = vi.fn();
    FakeObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    settings = { load: vi.fn().mockResolvedValue({}), save: vi.fn().mockResolvedValue({}) };
    audio = { list: vi.fn().mockResolvedValue([]), contentUrl: vi.fn((b: number, a: number) => `/api/books/${b}/audio/${a}/content`),
      savePosition: vi.fn().mockResolvedValue(undefined) };
    api = {
      chapters: vi.fn().mockResolvedValue({ title: 'My Book', chapters }),
      position: vi.fn().mockResolvedValue({ chapterIndex: 0, paragraphIndex: 0 }),
      savePosition: vi.fn().mockResolvedValue(undefined),
      search: vi.fn(),
      chapter: vi.fn((_id: number, index: number): Promise<Chapter> =>
        Promise.resolve({ title: `Chapter ${index}`, paragraphs: [`first ${index}`, `second ${index}`] })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'books/:id', component: ReaderComponent }]),
        { provide: ReaderService, useValue: api },
        { provide: SettingsService, useValue: settings },
        { provide: AudioService, useValue: audio },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return { harness, el: harness.routeNativeElement as HTMLElement };
  }

  const button = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === text)!;
  const paragraphs = (el: HTMLElement) => Array.from(el.querySelectorAll('article p')).map((p) => p.textContent);

  it('shows book title, chapter title and paragraphs in order, with a link back', async () => {
    const { el } = await open('/books/5');
    expect(api.chapter).toHaveBeenCalledWith(5, 0);
    expect(el.querySelector('h1')!.textContent).toBe('My Book');
    expect(el.querySelector('h2')!.textContent).toBe('Chapter 0');
    expect(paragraphs(el)).toEqual(['first 0', 'second 0']);
    expect(el.querySelector('a')!.getAttribute('href')).toBe('/');
  });

  it('opens the chapter from the query and highlights it in the list', async () => {
    const { el } = await open('/books/5?chapter=2');
    expect(el.querySelector('h2')!.textContent).toBe('Chapter 2');
    expect(el.querySelector('nav .current')!.textContent!.trim()).toBe('Chapter 2');
  });

  it('opens a chapter from the list and updates the URL', async () => {
    const { harness, el } = await open('/books/5');
    button(el, 'Chapter 1').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelector('h2')!.textContent).toBe('Chapter 1');
    expect(el.querySelector('nav .current')!.textContent!.trim()).toBe('Chapter 1');
    expect(TestBed.inject(Router).url).toBe('/books/5?chapter=1');
    // The chapter list is not fetched again when only the chapter changes.
    expect(api.chapters).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('moves with Next and Previous and disables them at the ends', async () => {
    const { harness, el } = await open('/books/5');
    expect(button(el, 'Previous').disabled).toBe(true);
    expect(button(el, 'Next').disabled).toBe(false);
    button(el, 'Next').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelector('h2')!.textContent).toBe('Chapter 1');
    button(el, 'Next').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(button(el, 'Next').disabled).toBe(true);
    button(el, 'Previous').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelector('h2')!.textContent).toBe('Chapter 1');
  });

  it('falls back to the first chapter for an invalid ?chapter value', async () => {
    const { el } = await open('/books/5?chapter=abc');
    expect(api.chapter).toHaveBeenCalledWith(5, 0);
    expect(el.querySelector('h2')!.textContent).toBe('Chapter 0');
  });

  it('shows an error when the chapter does not exist', async () => {
    api.chapter.mockRejectedValue(new Error('404'));
    const { el } = await open('/books/5?chapter=99');
    expect(el.querySelector('[role=alert]')!.textContent).toContain('404');
    expect(consoleError).toHaveBeenCalled();
  });

  it('keeps the title and chapter list visible while the next chapter loads', async () => {
    const { harness, el } = await open('/books/5');
    api.chapter.mockReturnValue(new Promise(() => undefined));
    button(el, 'Next').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelector('h1')!.textContent).toBe('My Book');
    expect(el.querySelectorAll('nav button').length).toBe(3);
    expect(el.querySelector('article')!.textContent).toContain('Loading...');
  });

  it('works for a single-chapter book', async () => {
    api.chapters.mockResolvedValue({ title: 'Short', chapters: [chapters[0]] });
    const { el } = await open('/books/5');
    expect(button(el, 'Previous').disabled).toBe(true);
    expect(button(el, 'Next').disabled).toBe(true);
  });

  it('shows an error with a link back when the book is not found', async () => {
    api.chapters.mockRejectedValue(new Error('404'));
    const { el } = await open('/books/99');
    expect(el.querySelector('[role=alert]')!.textContent).toContain('404');
    expect(el.querySelector('a')!.getAttribute('href')).toBe('/');
  });

  describe('appearance', () => {
    const select = (el: HTMLElement, key: string) => el.querySelector<HTMLSelectElement>(`select[name="${key}"]`)!;
    const choose = async (harness: RouterTestingHarness, key: string, value: string) => {
      const s = select(harness.routeNativeElement as HTMLElement, key);
      s.value = value;
      s.dispatchEvent(new Event('change'));
      await harness.fixture.whenStable();
      harness.detectChanges();
    };

    it('shows the defaults as selected and on the article', async () => {
      const { el } = await open('/books/5?chapter=0');
      expect(select(el, 'reader.fontSize').value).toBe('medium');
      expect(select(el, 'reader.theme').value).toBe('light');
      expect(select(el, 'reader.width').value).toBe('medium');
      expect(select(el, 'reader.fontSize').options.length).toBe(4);
      expect(el.querySelector('article')!.getAttribute('data-font')).toBe('medium');
    });

    it.each([
      ['reader.fontSize', 'xlarge', 'data-font'],
      ['reader.width', 'wide', 'data-width'],
    ])('%s change updates the article and sends the PUT', async (key, value, attr) => {
      const { harness, el } = await open('/books/5?chapter=0');
      await choose(harness, key, value);
      expect(el.querySelector('article')!.getAttribute(attr)).toBe(value);
      expect(settings.save).toHaveBeenCalledWith({ [key]: value });
    });

    it('theme change sends the PUT and sets the root class', async () => {
      const { harness } = await open('/books/5?chapter=0');
      await choose(harness, 'reader.theme', 'dark');
      TestBed.tick();
      expect(settings.save).toHaveBeenCalledWith({ 'reader.theme': 'dark' });
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      document.documentElement.classList.remove('dark');
    });

    it('shows a message when saving fails', async () => {
      settings.save.mockRejectedValue(new Error('offline'));
      const { harness, el } = await open('/books/5?chapter=0');
      await choose(harness, 'reader.width', 'narrow');
      expect(el.querySelector('[role=alert]')!.textContent).toContain('offline');
      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('reading position', () => {
    const settle = async (harness: { fixture: { whenStable(): Promise<unknown> }; detectChanges(): void }) => {
      await harness.fixture.whenStable();
      harness.detectChanges();
    };

    it('resumes at the saved chapter and paragraph when there is no ?chapter', async () => {
      api.position.mockResolvedValue({ chapterIndex: 2, paragraphIndex: 1 });
      const { el } = await open('/books/5');
      expect(api.chapter).toHaveBeenCalledWith(5, 2);
      expect(el.querySelector('h2')!.textContent).toBe('Chapter 2');
      const scrolled = (Element.prototype.scrollIntoView as Mock).mock.contexts[0] as HTMLElement;
      expect(scrolled.textContent).toBe('second 2');
      // Resuming is not a change, so nothing is saved.
      expect(api.savePosition).not.toHaveBeenCalled();
    });

    it('scrolls to the top when the saved paragraph is beyond the chapter end', async () => {
      api.position.mockResolvedValue({ chapterIndex: 1, paragraphIndex: 50 });
      await open('/books/5');
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
      expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    });

    it('lets ?chapter override the saved position and opens from the top', async () => {
      api.position.mockResolvedValue({ chapterIndex: 2, paragraphIndex: 1 });
      await open('/books/5?chapter=1');
      expect(api.position).not.toHaveBeenCalled();
      expect(api.chapter).toHaveBeenCalledWith(5, 1);
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
      expect(api.savePosition).toHaveBeenCalledWith(5, { chapterIndex: 1, paragraphIndex: 0 });
    });

    it('falls back to the top of chapter 0 with a message when the saved position is invalid', async () => {
      api.position.mockResolvedValue({ chapterIndex: 9, paragraphIndex: 0 });
      api.chapter.mockImplementation((_id: number, index: number) =>
        index === 9 ? Promise.reject(new Error('404')) : Promise.resolve({ title: `Chapter ${index}`, paragraphs: ['a'] }));
      const { el } = await open('/books/5');
      expect(el.querySelector('[role=alert]')!.textContent).toContain('404');
      expect(consoleError).toHaveBeenCalled();
      expect(el.querySelector('h2')!.textContent).toBe('Chapter 0');
    });

    it('falls back to chapter 0 when the position cannot be read', async () => {
      api.position.mockRejectedValue(new Error('404'));
      const { el } = await open('/books/5');
      expect(el.querySelector('[role=alert]')!.textContent).toContain('404');
      expect(consoleError).toHaveBeenCalled();
      expect(el.querySelector('h2')!.textContent).toBe('Chapter 0');
    });

    it('saves once after a burst of scrolling (debounced)', async () => {
      api.chapter.mockResolvedValue({ title: 'Long', paragraphs: ['a', 'b', 'c', 'd'] });
      await open('/books/5');
      vi.useFakeTimers();
      observer().report(1);
      vi.advanceTimersByTime(500);
      observer().report(1, false);
      observer().report(2);
      vi.advanceTimersByTime(999);
      expect(api.savePosition).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(api.savePosition).toHaveBeenCalledTimes(1);
      expect(api.savePosition).toHaveBeenCalledWith(5, { chapterIndex: 0, paragraphIndex: 2 });
    });

    it('uses the first visible paragraph as the current one', async () => {
      await open('/books/5');
      vi.useFakeTimers();
      observer().report(1);
      observer().report(0);
      vi.advanceTimersByTime(1000);
      // Paragraph 0 is the saved default, so there is nothing new to save.
      expect(api.savePosition).not.toHaveBeenCalled();
    });

    it('saves immediately at paragraph 0 when the chapter changes and drops the pending save', async () => {
      const { harness, el } = await open('/books/5');
      vi.useFakeTimers();
      observer().report(1);
      button(el, 'Next').click();
      // whenStable() waits on timers, so with fake timers let the async work run by advancing the clock.
      await vi.advanceTimersByTimeAsync(1000);
      harness.detectChanges();
      expect(api.savePosition).toHaveBeenCalledTimes(1);
      expect(api.savePosition).toHaveBeenCalledWith(5, { chapterIndex: 1, paragraphIndex: 0 });
    });

    it('flushes a pending save when the reader is destroyed', async () => {
      const { harness } = await open('/books/5');
      vi.useFakeTimers();
      observer().report(1);
      harness.fixture.destroy();
      expect(api.savePosition).toHaveBeenCalledWith(5, { chapterIndex: 0, paragraphIndex: 1 });
    });

    it('shows a message and keeps the book readable when a save fails', async () => {
      api.savePosition.mockRejectedValue(new Error('offline'));
      const { harness, el } = await open('/books/5?chapter=1');
      await settle(harness);
      expect(el.querySelector('[role=alert]')!.textContent).toContain('offline');
      expect(el.querySelector('h2')!.textContent).toBe('Chapter 1');
      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('selection', () => {
    const preview = (el: HTMLElement) => el.querySelector('.preview');
    /** Selects the whole text of `node` (or clears the selection) and lets the debounce fire. */
    async function selectText(harness: { detectChanges(): void }, node: Node | null) {
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.addRange(range);
      }
      document.dispatchEvent(new Event('selectionchange'));
      await vi.advanceTimersByTimeAsync(200);
      harness.detectChanges();
    }

    it('shows a preview for a selection in the chapter text and keeps it when the selection is cleared', async () => {
      const { harness, el } = await open('/books/5');
      vi.useFakeTimers();
      await selectText(harness, el.querySelector('article p'));
      expect(preview(el)!.textContent).toContain('first 0');
      expect(button(el, 'Translate').disabled).toBe(false);
      expect(button(el, 'Translate').disabled).toBe(false);
      // The panel keeps the last selection when the selection in the text is cleared.
      await selectText(harness, null);
      expect(preview(el)!.textContent).toContain('first 0');
      expect(button(el, 'Translate').disabled).toBe(false);
    });

    it('ignores a selection outside the chapter text', async () => {
      const { harness, el } = await open('/books/5');
      vi.useFakeTimers();
      await selectText(harness, el.querySelector('h1'));
      expect(preview(el)).toBeNull();
    });

    it('hides when the chapter changes', async () => {
      const { harness, el } = await open('/books/5');
      vi.useFakeTimers();
      await selectText(harness, el.querySelector('article p'));
      expect(preview(el)).not.toBeNull();
      vi.useRealTimers();
      button(el, 'Next').click();
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(el.querySelector('h2')!.textContent).toBe('Chapter 1');
      expect(preview(el)).toBeNull();
    });

    it('stops listening after destroy', async () => {
      const { harness } = await open('/books/5');
      const remove = vi.spyOn(document, 'removeEventListener');
      harness.fixture.destroy();
      expect(remove).toHaveBeenCalledWith('selectionchange', expect.any(Function));
    });
  });

  describe('audio player', () => {
    const file = (id: number, fromChapter: number, toChapter: number, positionSeconds = 0) => ({ id, fileName: `${id}.mp3`, sizeBytes: 1, fromChapter, toChapter, positionSeconds });
    const player = (el: HTMLElement) => el.querySelector('app-player-bar');

    it('shows the player with the file that covers the open chapter and leaves room for it', async () => {
      audio.list.mockResolvedValue([file(7, 0, 0), file(8, 1, 2, 33.5)]);
      const { harness, el } = await open('/books/5?chapter=1');
      expect(audio.list).toHaveBeenCalledWith(5);
      expect(audio.contentUrl).toHaveBeenLastCalledWith(5, 8);
      expect(player(el)).not.toBeNull();
      const bar = harness.fixture.debugElement.query(By.directive(PlayerBarComponent)).componentInstance as PlayerBarComponent;
      expect([bar.bookId(), bar.audioId(), bar.startPosition()]).toEqual([5, 8, 33.5]);
    });

    type Harness = Awaited<ReturnType<typeof open>>['harness'];
    const bars = (harness: Harness) => harness.fixture.debugElement.queryAll(By.directive(PlayerBarComponent));
    // Pretends the player of file 7 restored its position and was then moved to 5 s (jsdom loads no media).
    const listenTo5s = (harness: Harness) => {
      const bar = bars(harness)[0];
      (bar.componentInstance as { positionRestored: boolean }).positionRestored = true;
      bar.nativeElement.querySelector('audio').currentTime = 5;
    };
    const goNext = async (harness: Harness, el: HTMLElement) => {
      button(el, 'Next').click();
      await harness.fixture.whenStable();
      harness.detectChanges();
    };

    it('shows "No audio for this chapter" instead of the player when the book has audio but not for this chapter', async () => {
      audio.list.mockResolvedValue([file(7, 1, 2)]);
      const { el } = await open('/books/5?chapter=0');
      expect(player(el)).toBeNull();
      expect(el.querySelector('.no-audio')!.textContent).toContain('No audio for this chapter');
    });

    it('shows only the recorder, without player or message, when the book has no audio', async () => {
      const { el } = await open('/books/5?chapter=0');
      expect(player(el)).toBeNull();
      expect(el.querySelector('.no-audio')).toBeNull();
      expect(el.querySelector('app-recorder')).not.toBeNull();
    });

    it('keeps the recorder (and the take) when the player is replaced by "No audio for this chapter"', async () => {
      audio.list.mockResolvedValue([file(7, 0, 0)]);
      const { harness, el } = await open('/books/5?chapter=0');
      const recorder = el.querySelector('app-recorder');
      await goNext(harness, el);
      expect(player(el)).toBeNull();
      expect(el.querySelector('app-recorder')).toBe(recorder);
    });

    it('pauses the player when a recording starts', async () => {
      audio.list.mockResolvedValue([file(7, 0, 1)]);
      const { harness } = await open('/books/5?chapter=0');
      const bar = harness.fixture.debugElement.query(By.directive(PlayerBarComponent)).componentInstance as PlayerBarComponent;
      const pause = vi.spyOn(bar, 'pause').mockImplementation(() => undefined);
      harness.fixture.debugElement.query(By.directive(RecorderComponent)).componentInstance.started.emit();
      expect(pause).toHaveBeenCalled();
    });

    it('keeps the same player instance when the next chapter is covered by the same file', async () => {
      audio.list.mockResolvedValue([file(7, 0, 1)]);
      const { harness, el } = await open('/books/5?chapter=0');
      const before = bars(harness)[0].componentInstance;
      await goNext(harness, el);
      expect(bars(harness)).toHaveLength(1);
      expect(bars(harness)[0].componentInstance).toBe(before);
    });

    it('creates a new paused player (and destroys the old one, which saves) when a different file covers the chapter', async () => {
      audio.list.mockResolvedValue([file(7, 0, 0), file(8, 1, 1, 12)]);
      const { harness, el } = await open('/books/5?chapter=0');
      const before = bars(harness)[0].componentInstance;
      listenTo5s(harness);
      await goNext(harness, el);
      expect(audio.savePosition).toHaveBeenCalledExactlyOnceWith(5, 7, 5);
      const after = bars(harness)[0].componentInstance as PlayerBarComponent;
      expect(after).not.toBe(before);
      expect([after.audioId(), after.startPosition()]).toEqual([8, 12]);
      expect(bars(harness)[0].nativeElement.querySelector('audio').paused).toBe(true);
    });

    it('removes the player, keeps the message, and brings the player back for a covered chapter', async () => {
      audio.list.mockResolvedValue([file(7, 0, 0), file(8, 2, 2)]);
      const { harness, el } = await open('/books/5?chapter=0');
      listenTo5s(harness);
      await goNext(harness, el);
      expect(audio.savePosition).toHaveBeenCalledExactlyOnceWith(5, 7, 5);
      expect(player(el)).toBeNull();
      expect(el.querySelector('.no-audio')).not.toBeNull();
      await goNext(harness, el);
      expect(bars(harness)).toHaveLength(1);
      expect(el.querySelector('.no-audio')).toBeNull();
    });

    it('shows a message, and still the text, when the audio list fails', async () => {
      audio.list.mockRejectedValue(new Error('audio down'));
      const { el } = await open('/books/5');
      expect(el.querySelector('[role=alert]')!.textContent).toContain('audio down');
      expect(paragraphs(el)).toEqual(['first 0', 'second 0']);
      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    const hit = { chapterIndex: 2, paragraphIndex: 1, chapterTitle: 'Chapter 2', snippet: 'second 2' };
    const highlighted = (el: HTMLElement) => Array.from(el.querySelectorAll('article p.search-hit')).map((p) => p.textContent);
    type Harness = Awaited<ReturnType<typeof open>>['harness'];

    async function settle(harness: Harness) {
      await harness.fixture.whenStable();
      harness.detectChanges();
    }

    async function searchFor(el: HTMLElement, harness: Harness, text: string) {
      const input = el.querySelector('input[type=search]') as HTMLInputElement;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await settle(harness);
    }

    async function searchAndPick(el: HTMLElement, harness: Harness) {
      api.search.mockResolvedValue({ matches: [hit], hasMore: false });
      await searchFor(el, harness, 'second');
      el.querySelector<HTMLButtonElement>('li button')!.click();
      await settle(harness);
    }

    it('opens the chapter of a result, scrolls to the paragraph and highlights it', async () => {
      const { harness, el } = await open('/books/5?chapter=0');
      await searchAndPick(el, harness);
      expect(api.search).toHaveBeenCalledWith(5, 'second');
      expect(el.querySelector('h2')!.textContent).toBe('Chapter 2');
      expect(highlighted(el)).toEqual(['second 2']);
      expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toContain(el.querySelectorAll('article p')[1]);
      expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ block: 'center' });
      // Real paragraph heights while a hit is shown (see the has-hit style), so the target does not drift.
      expect(el.querySelector('article')!.classList).toContain('has-hit');
    });

    it('scrolls and highlights inside the open chapter without reloading it', async () => {
      const { harness, el } = await open('/books/5?chapter=2');
      api.chapter.mockClear();
      await searchAndPick(el, harness);
      expect(api.chapter).not.toHaveBeenCalled();
      expect(highlighted(el)).toEqual(['second 2']);
      expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ block: 'center' });
      expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1)).toBe(el.querySelectorAll('article p')[1]);
    });

    it('clears the highlight when another chapter is opened', async () => {
      const { harness, el } = await open('/books/5?chapter=0');
      await searchAndPick(el, harness);
      button(el, 'Chapter 1').click();
      await settle(harness);
      button(el, 'Chapter 2').click();
      await settle(harness);
      expect(highlighted(el)).toEqual([]);
    });

    it('clears the highlight when the search box is emptied', async () => {
      const { harness, el } = await open('/books/5?chapter=2');
      await searchAndPick(el, harness);
      await searchFor(el, harness, '');
      expect(highlighted(el)).toEqual([]);
    });
  });
});
