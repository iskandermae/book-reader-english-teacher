import { Injectable } from '@angular/core';
import { getApiSettings, getApiSettingsDefaults, putApiSettings } from '../api';

export type SettingsMap = Record<string, string>;

/** Thin wrapper over the generated client so components can be tested without HTTP. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  async load(): Promise<SettingsMap> {
    const { data } = await getApiSettings({ throwOnError: true });
    return data;
  }

  /** The built-in value of every setting (what a reset puts back). */
  async loadDefaults(): Promise<SettingsMap> {
    const { data } = await getApiSettingsDefaults({ throwOnError: true });
    return data;
  }

  /** Saves the given keys. Rejects with an Error whose message is the API's readable `detail`. */
  async save(values: SettingsMap): Promise<SettingsMap> {
    const { data, error } = await putApiSettings({ body: values });
    if (error || !data) {
      throw new Error(error?.detail ?? 'Could not save settings.');
    }
    return data;
  }
}
