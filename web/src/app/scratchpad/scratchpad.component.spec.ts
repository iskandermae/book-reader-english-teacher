import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LlmService } from '../reader/llm.service';
import { SAVE_DELAY_MS, ScratchpadComponent } from './scratchpad.component';
import { ScratchpadService } from './scratchpad.service';

describe('ScratchpadComponent', () => {
  let service: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };

  async function settle(fixture: ComponentFixture<ScratchpadComponent>) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render() {
    TestBed.configureTestingModule({
      imports: [ScratchpadComponent],
      providers: [
        provideRouter([]),
        { provide: ScratchpadService, useValue: service },
        { provide: LlmService, useValue: { translate: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ScratchpadComponent);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, area: el.querySelector('textarea')! };
  }

  const button = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === text)!;

  function type(area: HTMLTextAreaElement, value: string) {
    area.value = value;
    area.dispatchEvent(new Event('input'));
  }

  beforeEach(() => {
    service = { load: vi.fn().mockResolvedValue(''), save: vi.fn().mockResolvedValue(undefined) };
  });

  it('shows the saved text', async () => {
    service.load.mockResolvedValue('Saved text.');
    const { area } = await render();
    expect(area.value).toBe('Saved text.');
  });

  it('saves once after the edits stop (debounced)', async () => {
    const { area } = await render();
    vi.useFakeTimers();
    try {
      type(area, 'He');
      vi.advanceTimersByTime(SAVE_DELAY_MS - 1);
      type(area, 'Hello');
      vi.advanceTimersByTime(SAVE_DELAY_MS - 1);
      expect(service.save).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(service.save).toHaveBeenCalledOnce();
      expect(service.save).toHaveBeenCalledWith('Hello');
    } finally {
      vi.useRealTimers();
    }
  });

  it('saves pending edits when the page is left', async () => {
    const { fixture, area } = await render();
    type(area, 'Unsaved');
    fixture.destroy();
    await vi.waitFor(() => expect(service.save).toHaveBeenCalledWith('Unsaved'));
  });

  it('queues a second save behind the running one', async () => {
    let finishFirst!: () => void;
    service.save.mockReturnValueOnce(new Promise<void>((resolve) => (finishFirst = resolve)));
    const { fixture, el, area } = await render();
    vi.useFakeTimers();
    try {
      type(area, 'one');
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
      type(area, 'two');
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    } finally {
      vi.useRealTimers();
    }
    expect(service.save).toHaveBeenCalledTimes(1); // second one waits
    finishFirst();
    await vi.waitFor(() => expect(service.save).toHaveBeenCalledTimes(2));
    expect(service.save).toHaveBeenLastCalledWith('two');
    expect(el.querySelector('textarea')!.getAttribute('maxlength')).toBe('200000');
  });

  it('shows a save error', async () => {
    service.save.mockRejectedValue(new Error('Too long.'));
    const { fixture, el, area } = await render();
    vi.useFakeTimers();
    try {
      type(area, 'x');
      vi.advanceTimersByTime(SAVE_DELAY_MS);
    } finally {
      vi.useRealTimers();
    }
    await settle(fixture);
    expect(el.querySelector('[role=alert]')!.textContent).toContain('Too long.');
  });

  it('enables Translate when text is selected in the area', async () => {
    service.load.mockResolvedValue('Alpha one. Beta two.');
    const { fixture, el, area } = await render();
    expect(button(el, 'Translate').disabled).toBe(true);
    area.setSelectionRange(0, 5);
    area.dispatchEvent(new Event('select'));
    await settle(fixture);
    expect(button(el, 'Translate').disabled).toBe(false);
    expect(el.querySelector('.preview')!.textContent).toBe('Alpha');
  });

  it('clears the text only after confirmation and saves the empty text', async () => {
    service.load.mockResolvedValue('Some text');
    const { fixture, el, area } = await render();
    button(el, 'Clear text').click();
    await settle(fixture);
    button(el, 'No').click();
    await settle(fixture);
    expect(area.value).toBe('Some text');

    button(el, 'Clear text').click();
    await settle(fixture);
    button(el, 'Yes').click();
    await settle(fixture);
    expect(area.value).toBe('');
    expect(service.save).toHaveBeenCalledWith('');
  });

  it('shows a load error and keeps the area disabled', async () => {
    service.load.mockRejectedValue(new Error('down'));
    const { el, area } = await render();
    expect(el.querySelector('[role=alert]')!.textContent).toContain('down');
    expect(area.disabled).toBe(true);
  });
});
