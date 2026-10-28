import { Component, computed, DestroyRef, effect, ElementRef, inject, input, signal } from '@angular/core';
import { AppearanceService, PANEL_WIDTH } from '../appearance/appearance.service';
import { TextSelection } from './capture-selection';
import { LlmService } from './llm.service';

const PREVIEW_CHARS = 120;
const KEY_STEP = 2; // percent per arrow press

/**
 * Split view: the text (projected content) on the left, the AI result panel on the right.
 * It knows nothing about the reader: the text source only provides the current selection and
 * a `resetKey` whose change (e.g. another chapter) cancels and clears the running result.
 */
@Component({
  selector: 'app-workspace',
  styles: `
    :host { display: flex; flex: 1; min-width: 0; gap: 0.5rem; align-items: flex-start; }
    .text { flex: 1; min-width: 0; }
    /* The panel stays in view while the text scrolls. */
    /* The vertical scrollbar gets its own gutter and the right padding is larger, so text is never drawn under it.
       min-width 0 + flex none keep the width exactly as set; long words wrap instead of being clipped. */
    aside { position: sticky; top: 0; max-height: 100vh; flex: none; min-width: 0; overflow-x: hidden; overflow-y: auto;
            scrollbar-gutter: stable; box-sizing: border-box; padding: 0.5rem 1rem 0.5rem 0.5rem; }
    [role=separator] { align-self: stretch; width: 0.4rem; cursor: col-resize; background: GrayText; opacity: 0.4; touch-action: none; }
    [role=separator]:hover, [role=separator]:focus { opacity: 1; }
    .bar { display: flex; gap: 0.5rem; align-items: center; }
    .preview, .text-result { white-space: pre-wrap; overflow-wrap: anywhere; }
    .preview { opacity: 0.7; }
    @media (max-width: 800px) {
      :host { flex-direction: column; align-items: stretch; }
      aside { position: static; width: auto !important; max-height: none; flex: auto; }
      [role=separator] { display: none; }
    }
  `,
  template: `
    <div class="text"><ng-content /></div>
    <div role="separator" aria-orientation="vertical" aria-label="Resize result panel" tabindex="0"
         [attr.aria-valuenow]="width()" [attr.aria-valuemin]="min" [attr.aria-valuemax]="max"
         (pointerdown)="startDrag($event)" (pointermove)="drag($event)" (pointerup)="endDrag()"
         (pointercancel)="endDrag()" (keydown)="resizeByKey($event)" (keyup)="endDrag()"></div>
    <aside [style.width.%]="width()" aria-label="AI tools">
      <!-- mousedown is prevented so clicking an action does not clear the text selection -->
      <div class="bar" role="toolbar" aria-label="Selection tools" (mousedown)="$event.preventDefault()">
        <button type="button" [disabled]="!kept()" (click)="run('translate')">Translate</button>
        <button type="button" [disabled]="!kept()" (click)="run('explain')">Explain</button>
        <button type="button" [disabled]="!result()" (click)="clear()">Clear</button>
      </div>
      @if (preview(); as text) {
        <p class="preview">{{ text }}</p>
      }
      @if (result(); as r) {
        @if (r.loading && !r.text && !r.error) {
          <p>Working...</p>
        }
        <p class="text-result">{{ r.text }}</p>
        @if (r.error) {
          <p role="alert">{{ r.error }}</p>
        }
      }
    </aside>
  `,
})
export class WorkspaceComponent {
  /** The live selection of the text source; null when nothing usable is selected (it does not clear the panel). */
  readonly selection = input<TextSelection | null>(null);
  /** When this value changes the running request is cancelled and the result is cleared. */
  readonly resetKey = input<unknown>();

  private readonly llm = inject(LlmService);
  private readonly appearance = inject(AppearanceService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly min = PANEL_WIDTH.min;
  protected readonly max = PANEL_WIDTH.max;
  // Width while dragging; the setting is saved once, when the drag ends.
  private readonly dragWidth = signal<number | null>(null);
  protected readonly width = computed(() => this.dragWidth() ?? this.appearance.panelWidth());

  protected readonly result = signal<{ text: string; error: string; loading: boolean } | null>(null);
  private request: AbortController | null = null;

  // The last non-empty selection. Clearing the selection in the text keeps it, so actions still work on it.
  protected readonly kept = signal<TextSelection | null>(null);

  protected readonly preview = computed(() => {
    const text = this.kept()?.text ?? '';
    return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
  });

  constructor() {
    // Order matters: on the first run the reset must not wipe a selection that is already there.
    effect(() => {
      this.resetKey();
      this.kept.set(null);
      this.clear();
    });
    effect(() => {
      const current = this.selection();
      if (current) this.kept.set(current);
    });
    inject(DestroyRef).onDestroy(() => this.request?.abort());
  }

  protected async run(action: 'translate' | 'explain'): Promise<void> {
    const selected = this.kept();
    if (!selected) return;
    this.request?.abort(); // a new request replaces the running one
    const request = (this.request = new AbortController());
    this.result.set({ text: '', error: '', loading: true });
    try {
      for await (const chunk of this.llm[action](selected, request.signal)) {
        // A replaced or cleared request must not write into a newer result.
        if (this.request !== request) break;
        this.result.update((r) => r && { ...r, text: r.text + chunk, loading: false });
      }
    } catch (e) {
      if (!request.signal.aborted) {
        this.result.update((r) => r && { ...r, error: e instanceof Error ? e.message : 'The AI request failed.' });
      }
    } finally {
      if (this.request === request) this.result.update((r) => r && { ...r, loading: false });
    }
  }

  protected clear(): void {
    this.request?.abort();
    this.request = null;
    this.result.set(null);
  }

  protected startDrag(event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.dragWidth.set(this.width());
  }

  protected drag(event: PointerEvent): void {
    if (this.dragWidth() === null) return;
    const rect = this.host.getBoundingClientRect();
    if (!rect.width) return;
    this.dragWidth.set(this.clamp(((rect.right - event.clientX) / rect.width) * 100));
  }

  protected endDrag(): void {
    const width = this.dragWidth();
    this.dragWidth.set(null);
    if (width !== null) void this.appearance.setPanelWidth(width);
  }

  protected resizeByKey(event: KeyboardEvent): void {
    // The divider sits left of the panel: moving it left widens the panel.
    const step = event.key === 'ArrowLeft' ? KEY_STEP : event.key === 'ArrowRight' ? -KEY_STEP : 0;
    if (!step) return;
    event.preventDefault();
    // Live while the key is held; saved once on keyup (same path as the end of a drag).
    this.dragWidth.set(this.clamp(this.width() + step));
  }

  private clamp(percent: number): number {
    return Math.min(PANEL_WIDTH.max, Math.max(PANEL_WIDTH.min, percent));
  }
}
