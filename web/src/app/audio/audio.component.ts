import { Component, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChapterSummary, ReaderService } from '../reader/reader.service';
import { reportError } from '../report-error';
import { AudioFile, AudioService } from './audio.service';

/** An attached file plus the (possibly unsaved) range shown in its pickers. */
interface Row {
  file: AudioFile;
  from: number;
  to: number;
}

@Component({
  selector: 'app-audio',
  imports: [FormsModule, RouterLink],
  template: `
    <a routerLink="/">Back to library</a>
    <h1>Audio: {{ title() }}</h1>

    @if (loading()) {
      <p>Loading...</p>
    } @else if (loadError()) {
      <p role="alert">{{ loadError() }}</p>
    } @else {
      <form (ngSubmit)="upload()">
        <p><label>Audio files <input #picker type="file" name="file" accept="audio/*,.mp3" multiple (change)="pick($event)" /></label></p>
        <p>
          <label>From chapter {{ ' ' }}<select name="from" [(ngModel)]="from">
            @for (c of chapters(); track c.index) { <option [ngValue]="c.index">{{ label(c) }}</option> }
          </select></label>
          <label>To chapter {{ ' ' }}<select name="to" [(ngModel)]="to">
            @for (c of chapters(); track c.index) { <option [ngValue]="c.index">{{ label(c) }}</option> }
          </select></label>
        </p>
        @if (files().length > 1) {
          <p>The same range is used for every selected file. To give each file its own range, upload them one at a time or change the ranges afterwards.</p>
        }
        <button type="submit" [disabled]="files().length === 0 || busy()">Upload</button>
        @if (uploadError()) {
          <span role="alert">{{ uploadError() }}</span>
        }
      </form>

      @if (rows().length === 0) {
        <p>No audio files yet.</p>
      } @else {
        <ul aria-label="Audio files">
          @for (row of rows(); track row.file.id) {
            <li>
              {{ row.file.fileName }} ({{ sizeMb(row.file.sizeBytes) }} MB)
              <label>From <select [attr.aria-label]="'From chapter of ' + row.file.fileName" [(ngModel)]="row.from">
                @for (c of chapters(); track c.index) { <option [ngValue]="c.index">{{ label(c) }}</option> }
              </select></label>
              <label>To <select [attr.aria-label]="'To chapter of ' + row.file.fileName" [(ngModel)]="row.to">
                @for (c of chapters(); track c.index) { <option [ngValue]="c.index">{{ label(c) }}</option> }
              </select></label>
              <button type="button" [disabled]="busy() || !changed(row)" (click)="saveRange(row)">Save range</button>
              @if (confirmingId() === row.file.id) {
                Remove?
                <button type="button" (click)="remove(row)">Yes</button>
                <button type="button" (click)="confirmingId.set(null)">No</button>
              } @else {
                <button type="button" (click)="confirmingId.set(row.file.id)">Remove</button>
              }
            </li>
          }
        </ul>
      }
      @if (actionError()) {
        <p role="alert">{{ actionError() }}</p>
      }
    }
  `,
})
// Services reject with an Error (or problem details) carrying a readable message; reportError reads both.
export class AudioComponent implements OnInit {
  private readonly audio = inject(AudioService);
  private readonly reader = inject(ReaderService);
  private readonly bookId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');

  protected readonly title = signal('');
  protected readonly chapters = signal<ChapterSummary[]>([]);
  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly files = signal<File[]>([]);
  // Upload pickers; the default is the whole book.
  protected from = 0;
  protected to = 0;
  protected readonly busy = signal(false);
  protected readonly uploadError = signal('');
  protected readonly actionError = signal('');
  protected readonly confirmingId = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const book = await this.reader.chapters(this.bookId);
      this.title.set(book.title);
      this.chapters.set(book.chapters);
      this.to = book.chapters.length - 1;
      await this.refresh();
    } catch (e) {
      this.loadError.set(reportError('Could not load the audio files.', e));
    } finally {
      this.loading.set(false);
    }
  }

  protected label(c: ChapterSummary): string {
    return `${c.index + 1}. ${c.title}`;
  }

  protected sizeMb(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(1);
  }

  protected changed(row: Row): boolean {
    return row.from !== row.file.fromChapter || row.to !== row.file.toChapter;
  }

  protected pick(event: Event): void {
    this.files.set(Array.from((event.target as HTMLInputElement).files ?? []));
  }

  /** One request per file (the API takes one). Stops at the first failure; files already stored stay attached. */
  protected async upload(): Promise<void> {
    if (this.files().length === 0 || this.busy()) return;
    this.busy.set(true);
    this.uploadError.set('');
    try {
      for (const file of this.files()) {
        try {
          await this.audio.upload(this.bookId, file, this.from, this.to);
        } catch (e) {
          this.uploadError.set(reportError(`Could not upload ${file.name}.`, e));
          return;
        }
      }
      this.files.set([]);
      const input = this.picker();
      if (input) input.nativeElement.value = ''; // really reset the native picker
    } finally {
      this.busy.set(false);
      await this.refreshReporting();
    }
  }

  protected async saveRange(row: Row): Promise<void> {
    await this.act(() => this.audio.updateRange(this.bookId, row.file.id, row.from, row.to), 'Could not change the chapter range.');
  }

  protected async remove(row: Row): Promise<void> {
    this.confirmingId.set(null);
    await this.act(() => this.audio.remove(this.bookId, row.file.id), 'Could not remove the audio file.');
  }

  /** Runs a change, then reloads the list (also after a failure, so rejected edits snap back to the stored range). */
  private async act(change: () => Promise<void>, failure: string): Promise<void> {
    this.actionError.set('');
    this.busy.set(true);
    try {
      await change();
    } catch (e) {
      this.actionError.set(reportError(failure, e));
    } finally {
      this.busy.set(false);
      await this.refreshReporting();
    }
  }

  private async refreshReporting(): Promise<void> {
    try {
      await this.refresh();
    } catch (e) {
      this.actionError.set(reportError('Could not reload the audio files.', e));
    }
  }

  private async refresh(): Promise<void> {
    const files = await this.audio.list(this.bookId);
    this.rows.set(files.map((file) => ({ file, from: file.fromChapter, to: file.toChapter })));
  }
}
