import { Component, input, output } from '@angular/core';

/** Right side panel for AI results (translate, explain, simplify): a title, the streamed text and an error area. */
@Component({
  selector: 'app-ai-panel',
  host: { role: 'complementary', '[attr.aria-label]': 'title()' },
  styles: `
    :host { position: fixed; top: 0; right: 0; bottom: 0; z-index: 20; width: min(24rem, 100vw); overflow: auto;
            padding: 1rem; box-sizing: border-box; background: Canvas; color: CanvasText;
            border-left: 1px solid GrayText; box-shadow: -2px 0 6px rgb(0 0 0 / 0.3); }
    header { display: flex; justify-content: space-between; align-items: center; }
    .text { white-space: pre-wrap; }
  `,
  template: `
    <header>
      <h2>{{ title() }}</h2>
      <button type="button" aria-label="Close" (click)="closed.emit()">Close</button>
    </header>
    @if (loading() && !text() && !error()) {
      <p>Working...</p>
    }
    <p class="text">{{ text() }}</p>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
  `,
})
export class AiPanelComponent {
  readonly title = input.required<string>();
  readonly text = input('');
  readonly error = input('');
  /** True until the first chunk arrives. */
  readonly loading = input(false);
  readonly closed = output<void>();
}
