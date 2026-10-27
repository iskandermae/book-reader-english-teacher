import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ReaderComponent } from './reader.component';
import { Chapter, ReaderService } from './reader.service';
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
  type Mock = ReturnType<typeof vi.fn>;
  let api: { chapters: Mock; chapter: Mock; position: Mock; savePosition: Mock };
  let settings: { load: Mock; save: Mock };
  const observer = () => FakeObserver.instances[FakeObserver.instances.length - 1];

  beforeEach(() => {
    // jsdom does not implement scrolling.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Element.prototype.scrollIntoView = vi.fn();
    FakeObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    settings = { load: vi.fn().mockResolvedValue({}), save: vi.fn().mockResolvedValue({}) };
    api = {
      chapters: vi.fn().mockResolvedValue({ title: 'My Book', chapters }),
      position: vi.fn().mockResolvedValue({ chapterIndex: 0, paragraphIndex: 0 }),
      savePosition: vi.fn().mockResolvedValue(undefined),
      chapter: vi.fn((_id: number, index: number): Promise<Chapter> =>
        Promise.resolve({ title: `Chapter ${index}`, paragraphs: [`first ${index}`, `second ${index}`] })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'books/:id', component: ReaderComponent }]),
        { provide: ReaderService, useValue: api },
        { provide: SettingsService, useValue: settings },
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
    expect(el.querySelector('[role=alert]')!.textContent).toContain('Could not load');
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
    expect(el.querySelector('[role=alert]')!.textContent).toContain('Could not load');
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
      expect(el.querySelector('[role=alert]')!.textContent).toContain('Could not save');
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

    it('falls back to the top of chapter 0 without an error when the saved position is invalid', async () => {
      api.position.mockResolvedValue({ chapterIndex: 9, paragraphIndex: 0 });
      api.chapter.mockImplementation((_id: number, index: number) =>
        index === 9 ? Promise.reject(new Error('404')) : Promise.resolve({ title: `Chapter ${index}`, paragraphs: ['a'] }));
      const { el } = await open('/books/5');
      expect(el.querySelector('[role=alert]')).toBeNull();
      expect(el.querySelector('h2')!.textContent).toBe('Chapter 0');
    });

    it('falls back to chapter 0 when the position cannot be read', async () => {
      api.position.mockRejectedValue(new Error('404'));
      const { el } = await open('/books/5');
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

    it('ignores a failed save', async () => {
      api.savePosition.mockRejectedValue(new Error('offline'));
      const { el } = await open('/books/5?chapter=1');
      expect(el.querySelector('[role=alert]')).toBeNull();
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
});
