import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ReaderService } from '../reader/reader.service';
import { AudioComponent } from './audio.component';
import { AudioFile, AudioService } from './audio.service';

const chapters = [0, 1, 2].map((index) => ({ index, title: `Chapter ${index}` }));
const stored = (id: number, fromChapter: number, toChapter: number): AudioFile => ({
  id,
  fileName: `part${id}.mp3`,
  sizeBytes: 3 * 1024 * 1024,
  fromChapter,
  toChapter,
});

describe('AudioComponent', () => {
  // Failures are logged on purpose; keep the test output clean and let tests assert on it.
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => consoleError.mockRestore());

  type Mock = ReturnType<typeof vi.fn>;
  let api: { list: Mock; upload: Mock; updateRange: Mock; remove: Mock };

  async function render(files: AudioFile[] | Error = []) {
    api = {
      list: vi.fn().mockImplementation(() => (files instanceof Error ? Promise.reject(files) : Promise.resolve(files))),
      upload: vi.fn().mockResolvedValue(undefined),
      updateRange: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'books/:id/audio', component: AudioComponent }]),
        { provide: AudioService, useValue: api },
        { provide: ReaderService, useValue: { chapters: () => Promise.resolve({ title: 'My Book', chapters }) } },
      ],
    });
    const harness = await RouterTestingHarness.create('/books/7/audio');
    await settle(harness.fixture);
    return { fixture: harness.fixture, el: harness.fixture.nativeElement as HTMLElement };
  }

  async function settle(fixture: ComponentFixture<unknown>) {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable(); // ngModel writes values asynchronously
    fixture.detectChanges();
  }

  const button = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === text)!;
  const alerts = (el: HTMLElement) => Array.from(el.querySelectorAll('[role=alert]')).map((a) => a.textContent);

  function choose(el: HTMLElement, ...names: string[]): File[] {
    const input = el.querySelector<HTMLInputElement>('input[type=file]')!;
    const files = names.map((name) => new File(['audio'], name, { type: 'audio/mpeg' }));
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    return files;
  }

  function select(el: HTMLElement, selector: string, value: string) {
    const s = el.querySelector<HTMLSelectElement>(selector)!;
    s.selectedIndex = Array.from(s.options).findIndex((o) => o.text.startsWith(`${Number(value) + 1}.`));
    s.dispatchEvent(new Event('change'));
  }

  it('shows the empty state and defaults the pickers to the whole book', async () => {
    const { el } = await render();
    expect(el.textContent).toContain('No audio files yet.');
    const from = el.querySelector<HTMLSelectElement>('select[name=from]')!;
    const to = el.querySelector<HTMLSelectElement>('select[name=to]')!;
    expect(from.options.length).toBe(3);
    expect(from.selectedOptions[0].text).toBe('1. Chapter 0');
    expect(to.selectedOptions[0].text).toBe('3. Chapter 2');
  });

  it('uploads the chosen file with the chosen range and reloads the list', async () => {
    const { fixture, el } = await render();
    const [file] = choose(el, 'a.mp3');
    select(el, 'select[name=from]', '1');
    await settle(fixture);
    api.list.mockResolvedValue([stored(1, 1, 2)]);
    button(el, 'Upload').click();
    await settle(fixture);
    expect(api.upload).toHaveBeenCalledWith(7, file, 1, 2);
    expect(el.querySelector('ul[aria-label="Audio files"]')!.textContent).toContain('part1.mp3');
  });

  it('sends one request per file and stops at the first failure with the server message', async () => {
    const { fixture, el } = await render();
    const [first, second] = choose(el, 'a.mp3', 'b.mp3');
    await settle(fixture);
    api.upload.mockRejectedValueOnce(new Error('The range overlaps another audio file.'));
    button(el, 'Upload').click();
    await settle(fixture);
    expect(api.upload).toHaveBeenCalledTimes(1);
    expect(api.upload.mock.calls[0][1]).toBe(first);
    expect(second).toBeDefined();
    expect(alerts(el)[0]).toContain('The range overlaps another audio file.');
    expect(consoleError).toHaveBeenCalled();
  });

  it('keeps Upload disabled until a file is chosen', async () => {
    const { fixture, el } = await render();
    expect(button(el, 'Upload').disabled).toBe(true);
    choose(el, 'a.mp3');
    await settle(fixture);
    expect(button(el, 'Upload').disabled).toBe(false);
  });

  it('edits a range: Save is enabled only after a change and sends the new range', async () => {
    const { fixture, el } = await render([stored(5, 0, 2)]);
    expect(button(el, 'Save range').disabled).toBe(true);
    select(el, 'select[aria-label="To chapter of part5.mp3"]', '1');
    await settle(fixture);
    expect(button(el, 'Save range').disabled).toBe(false);
    api.list.mockResolvedValue([stored(5, 0, 1)]);
    button(el, 'Save range').click();
    await settle(fixture);
    expect(api.updateRange).toHaveBeenCalledWith(7, 5, 0, 1);
    expect(button(el, 'Save range').disabled).toBe(true);
  });

  it('shows the server message when the new range is rejected and restores the stored range', async () => {
    const { fixture, el } = await render([stored(5, 0, 2)]);
    select(el, 'select[aria-label="To chapter of part5.mp3"]', '1');
    await settle(fixture);
    api.updateRange.mockRejectedValue(new Error('From chapter must not be after To chapter.'));
    button(el, 'Save range').click();
    await settle(fixture);
    expect(alerts(el)[0]).toContain('From chapter must not be after To chapter.');
    expect(el.querySelector<HTMLSelectElement>('select[aria-label="To chapter of part5.mp3"]')!.selectedOptions[0].text).toBe('3. Chapter 2');
    expect(consoleError).toHaveBeenCalled();
  });

  it('removes a file only after confirmation', async () => {
    const { fixture, el } = await render([stored(5, 0, 2)]);
    button(el, 'Remove').click();
    await settle(fixture);
    expect(api.remove).not.toHaveBeenCalled();
    api.list.mockResolvedValue([]);
    button(el, 'Yes').click();
    await settle(fixture);
    expect(api.remove).toHaveBeenCalledWith(7, 5);
    expect(el.textContent).toContain('No audio files yet.');
  });

  it('shows an error when removing fails', async () => {
    const { fixture, el } = await render([stored(5, 0, 2)]);
    api.remove.mockRejectedValue(new Error('Gone.'));
    button(el, 'Remove').click();
    await settle(fixture);
    button(el, 'Yes').click();
    await settle(fixture);
    expect(alerts(el)[0]).toContain('Gone.');
    expect(consoleError).toHaveBeenCalled();
  });

  it('shows an error when the audio list cannot be loaded', async () => {
    const { el } = await render(new Error('down'));
    expect(alerts(el)[0]).toContain('down');
    expect(consoleError).toHaveBeenCalled();
  });
});
