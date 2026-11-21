import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LlmCallEntry, LlmLogService } from './llm-log.service';
import { LlmLogComponent } from './llm-log.component';
import { BooksService } from '../library/books.service';
import { LibraryComponent } from '../library/library.component';

const entry = (action: string, error: string | null = null): LlmCallEntry => ({
  time: '2026-11-21T10:00:00Z',
  action,
  model: 'llama3',
  prompt: `prompt of ${action}`,
  answer: `answer of ${action}`,
  durationMs: 1234,
  error,
});

describe('LlmLogComponent', () => {
  // Failures are logged on purpose; keep the test output clean and let tests assert on it.
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => consoleError.mockRestore());

  async function settle(fixture: ComponentFixture<LlmLogComponent>) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render(service: Partial<LlmLogService>) {
    TestBed.configureTestingModule({
      imports: [LlmLogComponent],
      providers: [provideRouter([]), { provide: LlmLogService, useValue: service }],
    });
    const fixture = TestBed.createComponent(LlmLogComponent);
    await settle(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const button = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === text)!;

  it('renders the entries in the given order with prompt, answer and error', async () => {
    const { el } = await render({ list: () => Promise.resolve([entry('translate'), entry('explain', 'Model crashed')]) });
    const items = el.querySelectorAll('details');
    expect(items.length).toBe(2);
    const summary = items[0].querySelector('summary')!.textContent;
    expect(summary).toContain('translate');
    expect(summary).toContain('llama3');
    expect(summary).toContain('1234 ms');
    expect(items[0].querySelectorAll('pre')[0].textContent).toBe('prompt of translate');
    expect(items[0].querySelectorAll('pre')[1].textContent).toBe('answer of translate');
    expect(items[0].querySelector('[role=alert]')).toBeNull();
    expect(items[1].querySelector('[role=alert]')!.textContent).toContain('Model crashed');
  });

  it('shows the empty state', async () => {
    const { el } = await render({ list: () => Promise.resolve([]) });
    expect(el.textContent).toContain('No LLM calls yet');
  });

  it('clears the log on the server and empties the list', async () => {
    const clear = vi.fn().mockResolvedValue(undefined);
    const { fixture, el } = await render({ list: () => Promise.resolve([entry('translate')]), clear });
    button(el, 'Clear').click();
    await settle(fixture);
    expect(clear).toHaveBeenCalled();
    expect(el.querySelectorAll('details').length).toBe(0);
    expect(el.textContent).toContain('No LLM calls yet');
  });

  it('keeps the list and shows an error when clearing fails', async () => {
    const { fixture, el } = await render({
      list: () => Promise.resolve([entry('translate')]),
      clear: () => Promise.reject(new Error('down')),
    });
    button(el, 'Clear').click();
    await settle(fixture);
    expect(el.querySelector('[role=alert]')!.textContent).toContain('down');
    expect(el.querySelectorAll('details').length).toBe(1);
    expect(consoleError).toHaveBeenCalled();
  });

  it('shows an error when the log cannot be loaded and reloads on Refresh', async () => {
    const list = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([entry('translate')]);
    const { fixture, el } = await render({ list });
    expect(el.querySelector('[role=alert]')!.textContent).toContain('down');
    button(el, 'Refresh').click();
    await settle(fixture);
    expect(el.querySelectorAll('details').length).toBe(1);
    expect(el.querySelector('[role=alert]')).toBeNull();
  });
});

describe('LLM log link', () => {
  it('opens in a new tab so the reading page stays open', async () => {
    TestBed.configureTestingModule({
      imports: [LibraryComponent],
      providers: [provideRouter([]), { provide: BooksService, useValue: { list: () => Promise.resolve([]) } }],
    });
    const fixture = TestBed.createComponent(LibraryComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'));
    const link = links.find((a) => a.textContent!.trim() === 'LLM log')!;
    expect(link.getAttribute('href')).toBe('/llm-log');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});
