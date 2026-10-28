import { effect, Injectable, inject, signal } from '@angular/core';
import { SettingsService } from '../settings/settings.service';
import { reportError } from '../report-error';

/** Allowed values per setting key (mirrors the backend validation, S1.7); the first one is the default. */
export const APPEARANCE_OPTIONS = {
  'reader.fontSize': ['medium', 'small', 'large', 'xlarge'],
  'reader.theme': ['light', 'dark'],
  'reader.width': ['medium', 'narrow', 'wide'],
} as const;

/** Share of the page width given to the result panel, in percent (mirrors the backend range). */
export const PANEL_WIDTH = { key: 'reader.panelWidth', min: 20, max: 70, default: 40 } as const;

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
  /** Non-empty when the last load or save failed; the new look stays for the session. */
  readonly saveError = signal('');
  readonly panelWidth = signal<number>(PANEL_WIDTH.default);

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
      const width = Number(saved[PANEL_WIDTH.key]);
      if (Number.isInteger(width) && width >= PANEL_WIDTH.min && width <= PANEL_WIDTH.max) this.panelWidth.set(width);
    } catch (e) {
      // Defaults stay; the reader still works, and the reader page shows this message.
      this.saveError.set(reportError('Could not load your appearance settings. Defaults are used.', e));
    }
  }

  /** Applies the value at once, then saves it. */
  async set(key: AppearanceKey, value: string): Promise<void> {
    this.values.update((v) => ({ ...v, [key]: value }));
    this.saveError.set('');
    try {
      await this.settings.save({ [key]: value });
    } catch (e) {
      this.saveError.set(saveFailed(e));
    }
  }

  /** Applies the width at once (clamped), then saves it; call it when a drag ends, not on every move. */
  async setPanelWidth(percent: number): Promise<void> {
    const width = Math.min(PANEL_WIDTH.max, Math.max(PANEL_WIDTH.min, Math.round(percent)));
    this.panelWidth.set(width);
    this.saveError.set('');
    try {
      await this.settings.save({ [PANEL_WIDTH.key]: String(width) });
    } catch (e) {
      this.saveError.set(saveFailed(e));
    }
  }
}

function saveFailed(e: unknown): string {
  return `${reportError('Could not save your appearance choice.', e)} The new look applies until you close the app.`;
}
