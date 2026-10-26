import { effect, Injectable, inject, signal } from '@angular/core';
import { SettingsService } from '../settings/settings.service';

/** Allowed values per setting key (mirrors the backend validation, S1.7); the first one is the default. */
export const APPEARANCE_OPTIONS = {
  'reader.fontSize': ['medium', 'small', 'large', 'xlarge'],
  'reader.theme': ['light', 'dark'],
  'reader.width': ['medium', 'narrow', 'wide'],
} as const;

export type AppearanceKey = keyof typeof APPEARANCE_OPTIONS;

const defaults = (): Record<AppearanceKey, string> => ({
  'reader.fontSize': 'medium',
  'reader.theme': 'light',
  'reader.width': 'medium',
});

/**
 * Holds the reader appearance settings for the whole app. Loaded once at start-up; the theme is applied
 * to the root element so every page is themed, while font size and width are read by the reader only.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private readonly settings = inject(SettingsService);

  readonly values = signal<Record<AppearanceKey, string>>(defaults());
  /** Non-empty when the last save failed; the new look stays for the session. */
  readonly saveError = signal('');

  constructor() {
    effect(() => document.documentElement.classList.toggle('dark', this.values()['reader.theme'] === 'dark'));
  }

  /** A failed load or an unknown value keeps the defaults. Never rejects, so it cannot block start-up. */
  async load(): Promise<void> {
    try {
      const saved = await this.settings.load();
      const next = defaults();
      for (const key of Object.keys(next) as AppearanceKey[]) {
        if ((APPEARANCE_OPTIONS[key] as readonly string[]).includes(saved[key])) next[key] = saved[key];
      }
      this.values.set(next);
    } catch {
      // Defaults stay; the reader still works.
    }
  }

  /** Applies the value at once, then saves it. */
  async set(key: AppearanceKey, value: string): Promise<void> {
    this.values.update((v) => ({ ...v, [key]: value }));
    this.saveError.set('');
    try {
      await this.settings.save({ [key]: value });
    } catch {
      this.saveError.set('Could not save your appearance choice. It applies until you close the app.');
    }
  }
}
