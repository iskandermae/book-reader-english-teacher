import { TestBed } from '@angular/core/testing';
import { BookSearchComponent } from './book-search.component';
import { ReaderService, SearchMatch, SearchResult } from './reader.service';

const match = (n: number): SearchMatch => ({ chapterIndex: n, paragraphIndex: n, chapterTitle: `Chapter ${n}`, snippet: `snippet ${n}` });

describe('BookSearchComponent', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let search: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    search = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: ReaderService, useValue: { search } }] });
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    consoleError.mockRestore();
  });

  function create() {
    const fixture = TestBed.createComponent(BookSearchComponent);
    fixture.componentRef.setInput('bookId', 7);
    const picked: SearchMatch[] = [];
    let cleared = 0;
    fixture.componentInstance.picked.subscribe((m) => picked.push(m));
    fixture.componentInstance.cleared.subscribe(() => cleared++);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input')!;
    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const settle = async () => {
      await vi.advanceTimersByTimeAsync(500);
      fixture.detectChanges();
    };
    return { el, input, type, settle, picked, cleared: () => cleared };
  }

  it('searches after a pause in typing and lists chapter title and snippet', async () => {
    search.mockResolvedValue({ matches: [match(1), match(2)], hasMore: false } satisfies SearchResult);
    const { el, type, settle } = create();
    type('hello');
    expect(search).not.toHaveBeenCalled();
    await settle();
    expect(search).toHaveBeenCalledWith(7, 'hello');
    expect(Array.from(el.querySelectorAll('li')).map((li) => li.textContent!.trim())).toEqual([
      'Chapter 1 snippet 1',
      'Chapter 2 snippet 2',
    ]);
  });

  it('searches at once on Enter and does not search again after the pause', async () => {
    search.mockResolvedValue({ matches: [], hasMore: false });
    const { input, type, settle } = create();
    type('hello');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('does not search for fewer than 2 characters (after trimming)', async () => {
    const { type, settle, cleared } = create();
    type(' a ');
    await settle();
    expect(search).not.toHaveBeenCalled();
    expect(cleared()).toBe(0);
  });

  it('reports a cleared box and drops the results', async () => {
    search.mockResolvedValue({ matches: [match(1)], hasMore: false });
    const { el, type, settle, cleared } = create();
    type('hello');
    await settle();
    type('');
    await settle();
    expect(cleared()).toBe(1);
    expect(el.querySelector('li')).toBeNull();
  });

  it('shows "No results"', async () => {
    search.mockResolvedValue({ matches: [], hasMore: false });
    const { el, type, settle } = create();
    type('nothing');
    await settle();
    expect(el.textContent).toContain('No results');
  });

  it('notes when only the first results are shown', async () => {
    search.mockResolvedValue({ matches: [match(1)], hasMore: true });
    const { el, type, settle } = create();
    type('many');
    await settle();
    expect(el.textContent).toContain('Showing first 1 results');
  });

  it('shows the server detail and logs a failed search', async () => {
    search.mockRejectedValue({ detail: 'Query too short' });
    const { el, type, settle } = create();
    type('boom');
    await settle();
    expect(el.querySelector('[role=alert]')!.textContent).toBe('Query too short');
    expect(consoleError).toHaveBeenCalled();
  });

  it('ignores a stale response that arrives after a newer one', async () => {
    let resolveOld!: (r: SearchResult) => void;
    search.mockReturnValueOnce(new Promise((res) => (resolveOld = res)));
    search.mockResolvedValueOnce({ matches: [match(2)], hasMore: false });
    const { el, type, settle } = create();
    type('old');
    await settle();
    type('new');
    await settle();
    resolveOld({ matches: [match(1)], hasMore: false });
    await settle();
    expect(el.textContent).toContain('snippet 2');
    expect(el.textContent).not.toContain('snippet 1');
  });

  it('emits the picked result', async () => {
    search.mockResolvedValue({ matches: [match(3)], hasMore: false });
    const { el, type, settle, picked } = create();
    type('hello');
    await settle();
    el.querySelector<HTMLButtonElement>('li button')!.click();
    expect(picked).toEqual([match(3)]);
  });
});
