import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActionsService, CustomAction } from './actions.service';
import { Placeholder, SettingsMap, SettingsService } from './settings.service';
import { reportError } from '../report-error';

/** The editable built-in prompts (setting key and label). */
const PROMPTS = [
  { key: 'prompt.translate', label: 'Translate' },
  { key: 'prompt.explain', label: 'Explain' },
];
const PROMPT_PREFIX = 'prompt.';
const MAX_ACTIONS = 20; // same limit as the API
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']; // CEFR; the API validates the same fixed set
const MODEL_KEY = 'ollama.model';
const LEVEL_KEY = 'language.level';
/** Text settings with their own label; every other non-prompt setting gets a plain input named by its key. */
const TEXT_FIELDS = [
  { key: 'language.native', label: 'Native language' },
  { key: 'language.from', label: 'From language' },
  { key: 'ollama.url', label: 'Ollama URL' },
];
const DEDICATED_KEYS = [...TEXT_FIELDS.map((f) => f.key), LEVEL_KEY, MODEL_KEY];

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
        @for (field of textFields; track field.key) {
          <p>
            <label>{{ field.label }} <input [name]="field.key" [attr.name]="field.key" [ngModel]="values()[field.key]" (ngModelChange)="update(field.key, $event)" /></label>
          </p>
        }
        <p>
          <label>English level
            <select name="language.level" [ngModel]="values()['language.level']" (ngModelChange)="update('language.level', $event)">
              @for (level of levels; track level) {
                <option [value]="level">{{ level }}</option>
              }
            </select>
          </label>
        </p>
        <p>
          <label>Model
            <select name="ollama.model" [ngModel]="values()['ollama.model']" (ngModelChange)="update('ollama.model', $event)">
              @for (model of modelOptions(); track model) {
                <option [value]="model">{{ model || '(none)' }}</option>
              }
            </select>
          </label>
          <button type="button" (click)="refreshModels()">Refresh</button>
        </p>
        @if (modelsError()) {
          <p role="alert">{{ modelsError() }}</p>
        }
        @for (key of keys(); track key) {
          <p>
            <label>{{ key }} <input [name]="key" [attr.name]="key" [ngModel]="values()[key]" (ngModelChange)="update(key, $event)" /></label>
          </p>
        }
      } @else {
        <p>Variables you can use in a prompt (<code>{{ '{selection}' }}</code> is required):</p>
        @if (placeholdersError()) {
          <p role="alert">{{ placeholdersError() }}</p>
        }
        <ul>
          @for (p of placeholders(); track p.name) {
            <li><code>{{ '{' + p.name + '}' }}</code> {{ p.description }}</li>
          }
        </ul>
        @for (prompt of prompts; track prompt.key) {
          <p>
            <label>{{ prompt.label }}<br />
              <textarea rows="10" cols="80" [name]="prompt.key" [attr.name]="prompt.key" [ngModel]="values()[prompt.key]" (ngModelChange)="update(prompt.key, $event)"></textarea>
            </label>
            <button type="button" (click)="reset(prompt.key)" [disabled]="!loaded()">Reset to default</button>
          </p>
        }
        <h2>Custom actions</h2>
        @for (action of actions(); track $index) {
          <p>
            <label>Name <input [name]="'action-name-' + $index" [attr.name]="'action-name-' + $index" maxlength="40"
                               [ngModel]="action.name" (ngModelChange)="editAction($index, { name: $event })" /></label>
            <button type="button" (click)="removeAction($index)">Delete</button><br />
            <textarea rows="6" cols="80" aria-label="Prompt" [name]="'action-prompt-' + $index" [attr.name]="'action-prompt-' + $index"
                      [ngModel]="action.prompt" (ngModelChange)="editAction($index, { prompt: $event })"></textarea>
          </p>
        }
        <button type="button" (click)="addAction()" [disabled]="!loaded() || actions().length >= maxActions">Add action</button>
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
  private readonly actionsService = inject(ActionsService);
  protected readonly actions = signal<CustomAction[]>([]);
  protected readonly maxActions = MAX_ACTIONS;
  protected readonly values = signal<SettingsMap>({});
  protected readonly keys = signal<string[]>([]); // the General tab: every setting except the prompts
  protected readonly prompts = PROMPTS;
  protected readonly textFields = TEXT_FIELDS;
  protected readonly levels = LEVELS;
  protected readonly placeholders = signal<Placeholder[]>([]);
  protected readonly placeholdersError = signal('');
  protected readonly models = signal<string[]>([]);
  protected readonly modelsError = signal('');
  // The installed models plus the saved one, so a saved model missing from the list stays visible and selected.
  protected readonly modelOptions = computed(() => {
    const saved = this.values()[MODEL_KEY] ?? '';
    return this.models().includes(saved) ? this.models() : [saved, ...this.models()];
  });
  protected readonly tab = signal<'general' | 'prompts'>('general');
  protected readonly loaded = signal(false);
  protected readonly message = signal('');
  protected readonly isError = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const [map, actions] = await Promise.all([this.settings.load(), this.actionsService.load()]);
      this.show(map);
      this.actions.set(actions);
      this.loaded.set(true);
    } catch (e) {
      this.report(reportError('Could not load settings.', e), true);
    }
    // Independent of the settings: a failure here must not block editing or saving them.
    await Promise.all([this.loadPlaceholders(), this.refreshModels()]);
  }

  protected async refreshModels(): Promise<void> {
    try {
      this.models.set(await this.settings.loadModels());
      this.modelsError.set('');
    } catch (e) {
      this.modelsError.set(reportError('Could not load the model list.', e)); // the saved model stays selected
    }
  }

  private async loadPlaceholders(): Promise<void> {
    try {
      this.placeholders.set(await this.settings.loadPlaceholders());
    } catch (e) {
      this.placeholdersError.set(reportError('Could not load the list of variables.', e));
    }
  }

  protected async save(): Promise<void> {
    try {
      this.show(await this.settings.save(this.values()));
      this.actions.set(await this.actionsService.save(this.actions())); // replaces the list; returns the assigned ids
      this.report('Settings saved.', false);
    } catch (e) {
      this.report(reportError('Could not save settings.', e), true);
    }
  }

  /** Puts the built-in text into the field; it is saved with the Save button like any edit. */
  protected async reset(key: string): Promise<void> {
    try {
      this.update(key, (await this.settings.loadDefaults())[key]);
      this.report('Default restored. Press Save to keep it.', false);
    } catch (e) {
      this.report(reportError('Could not load the default prompt.', e), true);
    }
  }

  protected addAction(): void {
    this.actions.update((list) => [...list, { name: '', prompt: '{selection}' }]);
  }

  protected removeAction(index: number): void {
    this.actions.update((list) => list.filter((_, i) => i !== index));
  }

  protected editAction(index: number, change: Partial<CustomAction>): void {
    this.actions.update((list) => list.map((a, i) => (i === index ? { ...a, ...change } : a)));
  }

  protected update(key: string, value: string): void {
    this.values.update((v) => ({ ...v, [key]: value }));
  }

  // The API returns the full map, so every setting it knows is rendered without a hardcoded list.
  private show(map: SettingsMap): void {
    this.values.set({ ...map });
    this.keys.set(Object.keys(map).filter((k) => !k.startsWith(PROMPT_PREFIX) && !DEDICATED_KEYS.includes(k)));
  }

  private report(text: string, error: boolean): void {
    this.message.set(text);
    this.isError.set(error);
  }
}
