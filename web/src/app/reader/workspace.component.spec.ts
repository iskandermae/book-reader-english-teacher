import { TestBed } from '@angular/core/testing';
import { AppearanceService } from '../appearance/appearance.service';
import { ActionsService } from '../settings/actions.service';
import { SettingsService } from '../settings/settings.service';
import { LlmService } from './llm.service';
import { WorkspaceComponent } from './workspace.component';

describe('WorkspaceComponent', () => {
  // Failures are logged on purpose; keep the test output clean and let tests assert on it.
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => consoleError.mockRestore());

  type Mock = ReturnType<typeof vi.fn>;
  let llm: { translate: Mock; explain: Mock; runAction: Mock };
  let actions: { load: Mock };
  let settings: { load: Mock; save: Mock };
  const selection = { text: 'first 0', context: 'first 0 context', paragraph: 'first 0 paragraph' };

  beforeEach(() => {
    llm = { translate: vi.fn(), explain: vi.fn(), runAction: vi.fn() };
    actions = { load: vi.fn().mockResolvedValue([]) };
    settings = { load: vi.fn().mockResolvedValue({}), save: vi.fn().mockResolvedValue({}) };
    TestBed.configureTestingModule({
      providers: [
        { provide: LlmService, useValue: llm },
        { provide: SettingsService, useValue: settings },
        { provide: ActionsService, useValue: actions },
      ],
    });
  });

  function create(sel: typeof selection | null = selection) {
    const fixture = TestBed.createComponent(WorkspaceComponent);
    fixture.componentRef.setInput('selection', sel);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === text)!;
    return { fixture, el, button };
  }

  /** A stream the test feeds by hand; records the abort signal that was passed in. */
  function controlledStream() {
    const queue: Array<string | Error | null> = [];
    let wake: (() => void) | undefined;
    const push = (item: string | Error | null) => {
      queue.push(item);
      wake?.();
    };
    const signals: AbortSignal[] = [];
    llm.translate.mockImplementation(async function* (_selection: unknown, signal: AbortSignal) {
      signals.push(signal);
      while (true) {
        while (!queue.length) await new Promise<void>((r) => (wake = r));
        const item = queue.shift()!;
        if (item === null) return;
        if (item instanceof Error) throw item;
        yield item;
      }
    });
    return { push, signals };
  }

  it('Explain sends the selection and context to the explain action and shows the result and errors', async () => {
    llm.explain.mockImplementation(async function* () {
      yield 'Meaning: x';
      throw new Error('Ollama is not running.');
    });
    const { fixture, el, button } = create();
    button('Explain').click();
    await settle(fixture);
    expect(llm.explain).toHaveBeenCalledWith(selection, expect.any(AbortSignal));
    expect(llm.translate).not.toHaveBeenCalled();
    expect(el.querySelector('.text-result')!.textContent).toBe('Meaning: x');
    expect(el.querySelector('[role=alert]')!.textContent).toContain('Ollama is not running.');
    expect(consoleError).toHaveBeenCalled();
  });

  it('shows a message when the custom actions cannot be loaded and keeps the built-in buttons working', async () => {
    actions.load.mockRejectedValue({ detail: 'Database is locked.' });
    llm.translate.mockImplementation(async function* () {
      yield 'Hallo';
    });
    const { fixture, el, button } = create();
    await settle(fixture);
    expect(el.querySelector('[role=alert]')!.textContent).toContain('Database is locked.');
    expect(consoleError).toHaveBeenCalled();
    button('Translate').click();
    await settle(fixture);
    expect(el.querySelector('.text-result')!.textContent).toBe('Hallo');
  });

  describe('custom actions', () => {
    const simplify = { id: 7, name: 'Simplify (B2)', prompt: 'x {selection}' };

    it('shows one button per action after the built-ins and runs it with its id and the selection', async () => {
      actions.load.mockResolvedValue([simplify]);
      llm.runAction.mockImplementation(async function* () {
        yield 'Simple ';
        yield 'text';
      });
      const { fixture, el, button } = create();
      await settle(fixture);
      expect(Array.from(el.querySelectorAll('.bar button')).map((b) => b.textContent!.trim())).toEqual([
        'Translate', 'Explain', 'Simplify (B2)', 'Clear',
      ]);
      button('Simplify (B2)').click();
      await settle(fixture);
      expect(llm.runAction).toHaveBeenCalledWith(7, selection, expect.any(AbortSignal));
      expect(el.querySelector('h2')!.textContent).toBe('Simplify (B2)');
      expect(el.querySelector('.text-result')!.textContent).toBe('Simple text');
    });

    it('shows a stream error and disables the button while nothing is selected', async () => {
      actions.load.mockResolvedValue([simplify]);
      llm.runAction.mockImplementation(async function* () {
        throw new Error('Ollama is not running.');
      });
      const empty = create(null);
      await settle(empty.fixture);
      expect(empty.button('Simplify (B2)').disabled).toBe(true);

      const { fixture, el, button } = create();
      await settle(fixture);
      button('Simplify (B2)').click();
      await settle(fixture);
      expect(el.querySelector('[role=alert]')!.textContent).toContain('Ollama is not running.');
    });

    it('still works with the built-in actions when the list cannot be loaded', async () => {
      actions.load.mockRejectedValue(new Error('down'));
      const { fixture, el } = create();
      await settle(fixture);
      expect(el.querySelectorAll('.bar button').length).toBe(3);
    });
  });

  it('disables Explain while nothing is selected', () => {
    expect(create(null).button('Explain').disabled).toBe(true);
  });

  const settle = async (fixture: { detectChanges(): void }) => {
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  };

  it('disables the buttons while nothing is selected', () => {
    const { button } = create(null);
    expect(button('Translate').disabled).toBe(true);
    expect(button('Clear').disabled).toBe(true);
  });

  it('keeps the last selection when the selection is cleared, and Translate still works on it', () => {
    const stream = controlledStream();
    const { fixture, el, button } = create();
    fixture.componentRef.setInput('selection', null);
    fixture.detectChanges();
    expect(el.querySelector('.preview')!.textContent).toBe('first 0');
    expect(button('Translate').disabled).toBe(false);
    button('Translate').click();
    expect(llm.translate).toHaveBeenCalledWith(selection, expect.any(AbortSignal));
    stream.push(null);
  });

  it('replaces the kept selection when a new one is made', () => {
    const { fixture, el } = create();
    fixture.componentRef.setInput('selection', { text: 'other', context: 'other', paragraph: 'other' });
    fixture.detectChanges();
    expect(el.querySelector('.preview')!.textContent).toBe('other');
  });

  it('keeps the result when the selection is cleared, and Clear keeps the selection', async () => {
    const stream = controlledStream();
    const { fixture, el, button } = create();
    button('Translate').click();
    stream.push('Done');
    await settle(fixture);
    fixture.componentRef.setInput('selection', null);
    fixture.detectChanges();
    expect(el.querySelector('.text-result')!.textContent).toBe('Done');
    button('Clear').click();
    fixture.detectChanges();
    expect(el.querySelector('.text-result')).toBeNull();
    expect(button('Translate').disabled).toBe(false);
    stream.push(null);
  });

  it('shows a preview of the selection and truncates a long one', () => {
    const { fixture, el } = create();
    expect(el.querySelector('.preview')!.textContent).toBe('first 0');
    fixture.componentRef.setInput('selection', { text: 'x'.repeat(300), context: '', paragraph: '' });
    fixture.detectChanges();
    expect(el.querySelector('.preview')!.textContent!.length).toBeLessThan(150);
  });

  it('streams the translation for the selected text and its context', async () => {
    const stream = controlledStream();
    const { fixture, el, button } = create();
    button('Translate').click();
    stream.push('Part ');
    stream.push('two');
    await settle(fixture);
    expect(llm.translate).toHaveBeenCalledWith(selection, expect.any(AbortSignal));
    expect(el.querySelector('.text-result')!.textContent).toBe('Part two');
    stream.push(null);
  });

  it('shows the error with its hint', async () => {
    const stream = controlledStream();
    const { fixture, el, button } = create();
    button('Translate').click();
    stream.push(new Error('Ollama is not running. Start it.'));
    await settle(fixture);
    expect(el.querySelector('[role=alert]')!.textContent).toContain('Ollama is not running. Start it.');
  });

  it('Clear cancels the running request and empties the result', async () => {
    const stream = controlledStream();
    const { fixture, el, button } = create();
    button('Translate').click();
    await settle(fixture);
    button('Clear').click();
    fixture.detectChanges();
    expect(stream.signals[0].aborted).toBe(true);
    expect(el.querySelector('.text-result')).toBeNull();
  });

  it('cancels the running request when a new one starts', async () => {
    const stream = controlledStream();
    const { fixture, button } = create();
    button('Translate').click();
    await settle(fixture);
    button('Translate').click();
    await settle(fixture);
    expect(stream.signals.map((s) => s.aborted)).toEqual([true, false]);
  });

  it('cancels and clears when the reset key changes', async () => {
    const stream = controlledStream();
    const { fixture, el, button } = create();
    button('Translate').click();
    await settle(fixture);
    fixture.componentRef.setInput('resetKey', 'chapter 2');
    fixture.detectChanges();
    expect(stream.signals[0].aborted).toBe(true);
    expect(el.querySelector('.text-result')).toBeNull();
    expect(el.querySelector('.preview')).toBeNull();
    expect(button('Translate').disabled).toBe(true);
  });

  it('does not clear the selection when the action bar is pressed', () => {
    const { el } = create();
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    el.querySelector('.bar')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  describe('divider', () => {
    const separator = (el: HTMLElement) => el.querySelector('[role=separator]') as HTMLElement;
    const key = (el: HTMLElement, k: string) =>
      separator(el).dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true }));
    const release = (el: HTMLElement) => separator(el).dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));

    it('starts at the remembered width', async () => {
      settings.load.mockResolvedValue({ 'reader.panelWidth': '55' });
      await TestBed.inject(AppearanceService).load();
      const { el } = create();
      expect(separator(el).getAttribute('aria-valuenow')).toBe('55');
    });

    it('arrow keys resize live within the limits and save once on key release', () => {
      const { fixture, el } = create();
      key(el, 'ArrowLeft'); // wider
      key(el, 'ArrowLeft');
      fixture.detectChanges();
      expect(separator(el).getAttribute('aria-valuenow')).toBe('44');
      expect(settings.save).not.toHaveBeenCalled();
      release(el);
      expect(settings.save).toHaveBeenCalledTimes(1);
      expect(settings.save).toHaveBeenLastCalledWith({ 'reader.panelWidth': '44' });
      for (let i = 0; i < 30; i++) key(el, 'ArrowRight');
      fixture.detectChanges();
      expect(separator(el).getAttribute('aria-valuenow')).toBe('20');
    });

    it('ignores an invalid saved width', async () => {
      settings.load.mockResolvedValue({ 'reader.panelWidth': '5' });
      await TestBed.inject(AppearanceService).load();
      const { el } = create();
      expect(separator(el).getAttribute('aria-valuenow')).toBe('40');
    });
  });
});
