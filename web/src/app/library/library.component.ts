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
    <a routerLink="/settings">Settings</a>

    <form (ngSubmit)="upload()">
      <p><label>File <input #picker type="file" name="file" accept=".txt" (change)="pick($event)" /></label></p>
      <p><label>Title <input name="title" [(ngModel)]="title" /></label></p>
      <button type="submit" [disabled]="!file() || uploading()">Import</button>
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
            {{ book.title }} - {{ book.chapterCount }} chapters - last opened:
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
  protected readonly file = signal<File | null>(null);
  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');
  protected title = '';
  protected readonly uploading = signal(false);
  protected readonly importError = signal('');
  protected readonly confirmingId = signal<number | null>(null);
  protected readonly deleteError = signal('');

  ngOnInit(): Promise<void> {
    return this.refresh();
  }

  protected pick(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.file.set(file);
    // Prefill the title from the file name without its extension; the user can still edit it.
    this.title = file ? file.name.replace(/\.[^.]*$/, '') : '';
  }

  protected async upload(): Promise<void> {
    const file = this.file();
    if (!file || this.uploading()) {
      return;
    }
    this.uploading.set(true);
    this.importError.set('');
    try {
      await this.booksApi.import(file, this.title);
      this.file.set(null);
      this.title = '';
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
