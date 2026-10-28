import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SettingsMap, SettingsService } from './settings.service';

/** The editable built-in prompts (setting key and label). */
const PROMPTS = [
  { key: 'prompt.translate', label: 'Translate' },
  { key: 'prompt.explain', label: 'Explain' },
];
const PROMPT_PREFIX = 'prompt.';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, RouterLink],
  template: `
    <h1>Settings</h1>
    <a routerLink="/">Library</a>{{ ' ' }}
    <a routerLink="/text">Text</a>
    <div role="tablist">
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'general'" (click)="tab.set('general')">General</button>
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'prompts'" (click)="tab.set('prompts')">Prompts</button>
    </div>
    <form (ngSubmit)="save()">
      <!-- [name] feeds NgModel (form control name); [attr.name] sets the DOM attribute, which NgModel does not. -->
      @if (tab() === 'general') {
        @for (key of keys(); track key) {
          <p>
            <label>{{ key }} <input [name]="key" [attr.name]="key" [ngModel]="values()[key]" (ngModelChange)="update(key, $event)" /></label>
          </p>
        }
      } @else {
        <p>
          Placeholders: <code>{{ '{selection}' }}</code> (required) <code>{{ '{sentence}' }}</code> <code>{{ '{paragraph}' }}</code>
          <code>{{ '{native_language}' }}</code> <code>{{ '{target_language}' }}</code> <code>{{ '{from_language}' }}</code>
        </p>
        @for (prompt of prompts; track prompt.key) {
          <p>
            <label>{{ prompt.label }}<br />
              <textarea rows="10" cols="80" [name]="prompt.key" [attr.name]="prompt.key" [ngModel]="values()[prompt.key]" (ngModelChange)="update(prompt.key, $event)"></textarea>
            </label>
            <button type="button" (click)="reset(prompt.key)" [disabled]="!loaded()">Reset to default</button>
          </p>
        }
      }
      <button type="submit" [disabled]="!loaded()">Save</button>
    </form>
    @if (message()) {
      <p [attr.role]="isError() ? 'alert' : 'status'">{{ message() }}</p>
    }
  `,
})
export class SettingsComponent implements OnInit {
  private readonly settings = inject(SettingsService);
  protected readonly values = signal<SettingsMap>({});
  protected readonly keys = signal<string[]>([]); // the General tab: every setting except the prompts
  protected readonly prompts = PROMPTS;
  protected readonly tab = signal<'general' | 'prompts'>('general');
  protected readonly loaded = signal(false);
  protected readonly message = signal('');
  protected readonly isError = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      this.show(await this.settings.load());
      this.loaded.set(true);
    } catch {
      this.report('Could not load settings.', true);
    }
  }

  protected async save(): Promise<void> {
    try {
      this.show(await this.settings.save(this.values()));
      this.report('Settings saved.', false);
    } catch (e) {
      this.report(e instanceof Error ? e.message : 'Could not save settings.', true);
    }
  }

  /** Puts the built-in text into the field; it is saved with the Save button like any edit. */
  protected async reset(key: string): Promise<void> {
    try {
      this.update(key, (await this.settings.loadDefaults())[key]);
      this.report('Default restored. Press Save to keep it.', false);
    } catch {
      this.report('Could not load the default prompt.', true);
    }
  }

  protected update(key: string, value: string): void {
    this.values.update((v) => ({ ...v, [key]: value }));
  }

  // The API returns the full map, so every setting it knows is rendered without a hardcoded list.
  private show(map: SettingsMap): void {
    this.values.set({ ...map });
    this.keys.set(Object.keys(map).filter((k) => !k.startsWith(PROMPT_PREFIX)));
  }

  private report(text: string, error: boolean): void {
    this.message.set(text);
    this.isError.set(error);
  }
}
