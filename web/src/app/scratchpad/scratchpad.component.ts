import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TextSelection } from '../reader/capture-selection';
import { captureTextAreaSelection } from '../reader/capture-text-area';
import { WorkspaceComponent } from '../reader/workspace.component';
import { ScratchpadService } from './scratchpad.service';
import { reportError } from '../report-error';

export const SAVE_DELAY_MS = 1000;
/** Same limit as the API (it rejects longer text). */
const MAX_LENGTH = 200_000;

/** "Text" page: a text area with the same AI tools as the reader; the text is saved automatically. */
@Component({
  selector: 'app-scratchpad',
  imports: [RouterLink, WorkspaceComponent],
  styles: `
    textarea { width: 100%; box-sizing: border-box; min-height: 70vh; font: inherit; }
  `,
  template: `
    <h1>Text</h1>
    <a routerLink="/">Library</a>
    @if (confirming()) {
      Clear the text?
      <button type="button" (click)="clear()">Yes</button>
      <button type="button" (click)="confirming.set(false)">No</button>
    } @else {
      <button type="button" [disabled]="!loaded() || !text()" (click)="confirming.set(true)">Clear text</button>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    <app-workspace [selection]="selection()" [resetKey]="clearCount()">
      <!-- Disabled until the saved text is loaded, so typing cannot be overwritten by (or overwrite) it. -->
      <textarea #area aria-label="Text" placeholder="Paste or type English text here" [disabled]="!loaded()"
                [attr.maxlength]="maxLength" [value]="text()" (input)="edit(area.value)"
                (select)="select(area)" (keyup)="select(area)" (mouseup)="select(area)"></textarea>
    </app-workspace>
  `,
})
export class ScratchpadComponent implements OnInit {
  private readonly api = inject(ScratchpadService);

  protected readonly text = signal('');
  protected readonly loaded = signal(false);
  protected readonly error = signal('');
  protected readonly confirming = signal(false);
  protected readonly selection = signal<TextSelection | null>(null);
  // Changes on "Clear text" so the workspace drops the preview and result of the removed text.
  protected readonly clearCount = signal(0);

  protected readonly maxLength = MAX_LENGTH;

  private timer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;
  // Saves run one after another, so an older request can never finish after (and overwrite) a newer one.
  private saving: Promise<void> = Promise.resolve();

  constructor() {
    // Leaving the page must not lose the last edits.
    inject(DestroyRef).onDestroy(() => this.flush());
  }

  async ngOnInit(): Promise<void> {
    try {
      this.text.set(await this.api.load());
      this.loaded.set(true);
    } catch (e) {
      this.error.set(reportError('Could not load the text.', e));
    }
  }

  protected edit(value: string): void {
    this.text.set(value);
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  protected select(area: HTMLTextAreaElement): void {
    // A collapsed selection gives null; the workspace keeps the last real one.
    this.selection.set(captureTextAreaSelection(area.value, area.selectionStart, area.selectionEnd));
  }

  protected clear(): void {
    this.confirming.set(false);
    this.text.set('');
    this.selection.set(null);
    this.clearCount.update((n) => n + 1);
    this.dirty = true;
    this.flush();
  }

  private flush(): void {
    clearTimeout(this.timer);
    if (!this.dirty) return;
    this.dirty = false;
    // The text is read when the save starts, so a queued save always sends the latest text.
    // A failed save is shown; the next edit saves the whole text again.
    this.saving = this.saving.then(() => this.api.save(this.text())).then(
      () => this.error.set(''),
      (e) => this.error.set(reportError('Could not save the text.', e)),
    );
  }
}
