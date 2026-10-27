import { DatePipe } from '@angular/common';
import { Component, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BookSummary, BooksService } from './books.service';

@Component({
  selector: 'app-library',
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <h1>Library</h1>
    <a routerLink="/text">Text</a>{{ ' ' }}
    <a routerLink="/settings">Settings</a>

    <form (ngSubmit)="upload()">
      <p><label>Files <input #picker type="file" name="file" accept=".txt" multiple (change)="pick($event)" /></label></p>
      @if (files().length > 1) {
        <ol aria-label="Selected files">
          @for (f of files(); track $index) {
            <li>{{ f.name }}</li>
          }
        </ol>
      }
      @if (sortError()) {
        <p role="alert">{{ sortError() }}</p>
      }
      <p><label>Title <input name="title" [(ngModel)]="title" /></label></p>
      <button type="submit" [disabled]="files().length === 0 || uploading()">Import</button>
      @if (importError()) {
        <span role="alert">{{ importError() }}</span>
      }
    </form>

    @if (loading()) {
      <p>Loading...</p>
    } @else if (loadError()) {
      <p role="alert">{{ loadError() }}</p>
    } @else if (books().length === 0) {
      <p>No books yet. Choose a .txt file, optionally edit the title, and press Import.</p>
    } @else {
      <ul>
        @for (book of books(); track book.id) {
          <li>
            <a [routerLink]="['/books', book.id]">{{ book.title }}</a>{{ ' - ' }}{{ book.chapterCount }} chapters - last opened:
            {{ book.lastOpenedAt ? (book.lastOpenedAt | date: 'medium') : 'never' }}
            @if (confirmingId() === book.id) {
              Delete?
              <button type="button" (click)="remove(book)">Yes</button>
              <button type="button" (click)="confirmingId.set(null)">No</button>
            } @else {
              <button type="button" (click)="confirmingId.set(book.id)">Delete</button>
            }
          </li>
        }
      </ul>
    }
    @if (deleteError()) {
      <p role="alert">{{ deleteError() }}</p>
    }
  `,
})
// BooksService always rejects with an Error carrying a readable message.
export class LibraryComponent implements OnInit {
  private readonly booksApi = inject(BooksService);
  protected readonly books = signal<BookSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  // Selected files, in the order returned by the server's natural sort (the order it merges them in).
  protected readonly files = signal<File[]>([]);
  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');
  protected title = '';
  protected readonly sortError = signal('');
  protected readonly uploading = signal(false);
  protected readonly importError = signal('');
  protected readonly confirmingId = signal<number | null>(null);
  protected readonly deleteError = signal('');

  ngOnInit(): Promise<void> {
    return this.refresh();
  }

  protected async pick(event: Event): Promise<void> {
    const picked = Array.from((event.target as HTMLInputElement).files ?? []);
    this.sortError.set('');
    this.setFiles(picked);
    if (picked.length < 2) {
      return;
    }
    const prefill = this.title;
    try {
      const sortedNames = await this.booksApi.sortNames(picked.map((f) => f.name));
      // Ignore a late answer if the user has picked other files meanwhile.
      if (this.files() === picked) {
        // Re-prefill only if the user has not edited the title in the meantime.
        this.setFiles(orderByNames(picked, sortedNames), this.title === prefill);
      }
    } catch {
      if (this.files() === picked) {
        // Keep the picked order: the server sorts on import anyway.
        this.sortError.set('Could not sort the files; the server will sort them on import.');
      }
    }
  }

  private setFiles(files: File[], updateTitle = true): void {
    this.files.set(files);
    if (updateTitle) {
      // Prefill the title from the first file name without its extension; the user can still edit it.
      this.title = files.length ? files[0].name.replace(/\.[^.]*$/, '') : '';
    }
  }

  protected async upload(): Promise<void> {
    const files = this.files();
    if (files.length === 0 || this.uploading()) {
      return;
    }
    this.uploading.set(true);
    this.importError.set('');
    try {
      await this.booksApi.import(files, this.title);
      this.files.set([]);
      this.title = '';
      this.sortError.set('');
      this.resetFileInput();
      await this.refresh();
    } catch (e) {
      this.importError.set((e as Error).message);
    } finally {
      this.uploading.set(false);
    }
  }

  protected async remove(book: BookSummary): Promise<void> {
    this.deleteError.set('');
    try {
      await this.booksApi.delete(book.id);
      this.books.update((list) => list.filter((b) => b.id !== book.id));
    } catch (e) {
      this.deleteError.set((e as Error).message);
    } finally {
      this.confirmingId.set(null);
    }
  }

  private async refresh(): Promise<void> {
    try {
      this.books.set(await this.booksApi.list());
      this.loadError.set('');
    } catch {
      this.loadError.set('Could not load the library.');
    } finally {
      this.loading.set(false);
    }
  }

  // Clears the native picker so the form is really reset and the same file can be chosen again.
  private resetFileInput(): void {
    this.picker().nativeElement.value = '';
  }
}

/** Reorders files to follow `names`; a file whose name is missing from the answer is kept at the end. */
function orderByNames(files: File[], names: string[]): File[] {
  const rest = [...files];
  const ordered = names.flatMap((name) => {
    const i = rest.findIndex((f) => f.name === name);
    return i < 0 ? [] : rest.splice(i, 1);
  });
  return [...ordered, ...rest];
}
