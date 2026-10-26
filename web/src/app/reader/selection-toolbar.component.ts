import { afterRenderEffect, Component, computed, ElementRef, inject, input, signal } from '@angular/core';
import { TextSelection } from './capture-selection';

const GAP_PX = 8;
const PREVIEW_CHARS = 60;

/** Floating toolbar over the selected text. Action buttons are added by later stories; for now it previews the text. */
@Component({
  selector: 'app-selection-toolbar',
  host: {
    role: 'toolbar',
    'aria-label': 'Selection tools',
    // Keep the browser selection alive when the toolbar is clicked.
    '(mousedown)': '$event.preventDefault()',
    '[style.top.px]': 'top()',
    '[style.left.px]': 'left()',
  },
  styles: `
    :host { position: absolute; z-index: 10; padding: 0.25rem 0.5rem; background: Canvas; color: CanvasText;
            border: 1px solid GrayText; border-radius: 0.25rem; box-shadow: 0 2px 6px rgb(0 0 0 / 0.3); }
  `,
  template: `<span class="preview">{{ preview() }}</span>`,
})
export class SelectionToolbarComponent {
  readonly selection = input.required<TextSelection>();
  /** Viewport rectangle of the selection. */
  readonly anchor = input.required<DOMRect>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  // Page coordinates (absolute positioning), so the toolbar scrolls together with the text.
  protected readonly top = signal(0);
  protected readonly left = signal(0);

  protected readonly preview = computed(() => {
    const text = this.selection().text;
    return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
  });

  constructor() {
    // Runs after rendering because the toolbar's own size is needed to place it.
    afterRenderEffect(() => {
      const rect = this.anchor();
      const { offsetWidth: width, offsetHeight: height } = this.el;
      const above = rect.top - height - GAP_PX;
      // Above the selection when there is room, otherwise below it.
      const viewportTop = Math.min(above >= 0 ? above : rect.bottom + GAP_PX, Math.max(0, window.innerHeight - height));
      const viewportLeft = Math.min(Math.max(0, rect.left), Math.max(0, window.innerWidth - width));
      this.top.set(viewportTop + window.scrollY);
      this.left.set(viewportLeft + window.scrollX);
    });
  }
}
