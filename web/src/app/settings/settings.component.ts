import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SettingsMap, SettingsService } from './settings.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, RouterLink],
  template: `
    <h1>Settings</h1>
    <a routerLink="/">Library</a>{{ ' ' }}
    <a routerLink="/text">Text</a>
    <form (ngSubmit)="save()">
      <!-- [name] feeds NgModel (form control name); [attr.name] sets the DOM attribute, which NgModel does not. -->
      @for (key of keys(); track key) {
        <p>
          <label>{{ key }} <input [name]="key" [attr.name]="key" [ngModel]="values()[key]" (ngModelChange)="update(key, $event)" /></label>
        </p>
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
  protected readonly keys = signal<string[]>([]);
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

  protected update(key: string, value: string): void {
    this.values.update((v) => ({ ...v, [key]: value }));
  }

  // The API returns the full map, so every setting it knows is rendered without a hardcoded list.
  private show(map: SettingsMap): void {
    this.values.set({ ...map });
    this.keys.set(Object.keys(map));
  }

  private report(text: string, error: boolean): void {
    this.message.set(text);
    this.isError.set(error);
  }
}
