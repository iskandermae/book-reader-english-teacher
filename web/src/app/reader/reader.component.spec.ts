import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ReaderComponent } from './reader.component';
import { Chapter, ReaderService } from './reader.service';

const chapters = [0, 1, 2].map((index) => ({ index, title: `Chapter ${index}` }));

describe('ReaderComponent', () => {
  let api: { chapters: ReturnType<typeof vi.fn>; chapter: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // jsdom does not implement scrolling.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    api = {
      chapters: vi.fn().mockResolvedValue({ title: 'My Book', chapters }),
      chapter: vi.fn((_id: number, index: number): Promise<Chapter> =>
        Promise.resolve({ title: `Chapter ${index}`, paragraphs: [`first ${index}`, `second ${index}`] })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'books/:id', component: ReaderComponent }]),
        { provide: ReaderService, useValue: api },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

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
});
