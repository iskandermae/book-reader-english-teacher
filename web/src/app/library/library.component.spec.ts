import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BooksService, BookSummary } from './books.service';
import { LibraryComponent } from './library.component';

const book = (id: number, lastOpenedAt: string | null = null): BookSummary => ({
  id,
  title: `Book ${id}`,
  chapterCount: id + 1,
  importedAt: '2026-01-01T00:00:00Z',
  lastOpenedAt,
});

describe('LibraryComponent', () => {
  async function settle(fixture: ComponentFixture<LibraryComponent>) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render(service: Partial<BooksService>) {
    TestBed.configureTestingModule({
      imports: [LibraryComponent],
      providers: [provideRouter([]), { provide: BooksService, useValue: service }],
    });
    const fixture = TestBed.createComponent(LibraryComponent);
    await settle(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function choose(el: HTMLElement, name: string): File {
    const input = el.querySelector<HTMLInputElement>('input[type=file]')!;
    const file = new File(['text'], name);
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    return file;
  }

  const buttons = (el: HTMLElement) => Array.from(el.querySelectorAll('button'));
  const button = (el: HTMLElement, text: string) => buttons(el).find((b) => b.textContent!.trim() === text)!;

  it('shows the empty state with import instructions', async () => {
    const { el } = await render({ list: () => Promise.resolve([]) });
    expect(el.textContent).toContain('Choose a .txt file');
  });

  it('lists books with chapter count and "never" for unopened books', async () => {
    const { el } = await render({
      list: () => Promise.resolve([book(1), book(2, '2026-02-03T10:00:00Z')]),
    });
    const rows = el.querySelectorAll('li');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Book 1');
    expect(rows[0].textContent).toContain('2 chapters');
    expect(rows[0].textContent).toContain('never');
    expect(rows[1].textContent).not.toContain('never');
  });

  it('shows an error when the list cannot be loaded', async () => {
    const { el } = await render({ list: () => Promise.reject(new Error('down')) });
    expect(el.querySelector('[role=alert]')!.textContent).toContain('Could not load the library');
  });

  it('prefills the title from the file name and enables Import', async () => {
    const { fixture, el } = await render({ list: () => Promise.resolve([]) });
    expect(button(el, 'Import').disabled).toBe(true);

    choose(el, 'My Book.v2.txt');
    await settle(fixture);

    expect(button(el, 'Import').disabled).toBe(false);
    expect(el.querySelector<HTMLInputElement>('input[name=title]')!.value).toBe('My Book.v2');
  });

  it('imports, refreshes the list and resets the form', async () => {
    const list = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([book(1)]);
    const importFn = vi.fn().mockResolvedValue(undefined);
    const { fixture, el } = await render({ list, import: importFn });
    const file = choose(el, 'a.txt');
    await settle(fixture);

    button(el, 'Import').click();
    await settle(fixture);

    expect(importFn).toHaveBeenCalledWith(file, 'a');
    expect(list).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll('li').length).toBe(1);
    expect(button(el, 'Import').disabled).toBe(true);
    expect(el.querySelector<HTMLInputElement>('input[name=title]')!.value).toBe('');
  });

  it('shows Loading... until the list resolves', async () => {
    let resolve!: (b: BookSummary[]) => void;
    TestBed.configureTestingModule({
      imports: [LibraryComponent],
      providers: [
        provideRouter([]),
        { provide: BooksService, useValue: { list: () => new Promise<BookSummary[]>((r) => (resolve = r)) } },
      ],
    });
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Loading...');

    resolve([]);
    await settle(fixture);
    expect(el.textContent).not.toContain('Loading...');
  });

  it('disables Import while uploading', async () => {
    let finish!: () => void;
    const { fixture, el } = await render({
      list: () => Promise.resolve([]),
      import: () => new Promise<void>((r) => (finish = r)),
    });
    choose(el, 'a.txt');
    await settle(fixture);

    button(el, 'Import').click();
    fixture.detectChanges();
    expect(button(el, 'Import').disabled).toBe(true);

    finish();
    await settle(fixture);
    expect(button(el, 'Import').disabled).toBe(true); // form reset, no file chosen
  });

  it('shows the API error detail when the import fails', async () => {
    const { fixture, el } = await render({
      list: () => Promise.resolve([]),
      import: () => Promise.reject(new Error('The file is empty.')),
    });
    choose(el, 'a.txt');
    await settle(fixture);

    button(el, 'Import').click();
    await settle(fixture);

    expect(el.querySelector('form [role=alert]')!.textContent).toContain('The file is empty.');
    expect(button(el, 'Import').disabled).toBe(false);
  });

  describe('delete', () => {
    it('asks for confirmation and cancels on No', async () => {
      const del = vi.fn();
      const { fixture, el } = await render({ list: () => Promise.resolve([book(1)]), delete: del });

      button(el, 'Delete').click();
      await settle(fixture);
      expect(el.querySelector('li')!.textContent).toContain('Delete?');

      button(el, 'No').click();
      await settle(fixture);

      expect(del).not.toHaveBeenCalled();
      expect(el.querySelectorAll('li').length).toBe(1);
      expect(buttons(el).some((b) => b.textContent!.trim() === 'Yes')).toBe(false);
    });

    it('removes the row on Yes', async () => {
      const del = vi.fn().mockResolvedValue(undefined);
      const { fixture, el } = await render({ list: () => Promise.resolve([book(1), book(2)]), delete: del });

      button(el, 'Delete').click();
      await settle(fixture);
      button(el, 'Yes').click();
      await settle(fixture);

      expect(del).toHaveBeenCalledWith(1);
      expect(el.querySelectorAll('li').length).toBe(1);
      expect(el.querySelector('li')!.textContent).toContain('Book 2');
    });

    it('keeps the row and shows an error when delete fails', async () => {
      const { fixture, el } = await render({
        list: () => Promise.resolve([book(1)]),
        delete: () => Promise.reject(new Error('No such book.')),
      });

      button(el, 'Delete').click();
      await settle(fixture);
      button(el, 'Yes').click();
      await settle(fixture);

      expect(el.querySelectorAll('li').length).toBe(1);
      expect(el.querySelector('[role=alert]')!.textContent).toContain('No such book.');
    });
  });
});
