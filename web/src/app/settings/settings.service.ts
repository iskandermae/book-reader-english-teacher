import { Injectable } from '@angular/core';
import { getApiLlmModels, getApiSettings, getApiSettingsDefaults, getApiSettingsPlaceholders, putApiSettings } from '../api';

export type SettingsMap = Record<string, string>;

/** A variable a prompt template may use (name without braces) and what it stands for. */
export interface Placeholder {
  name: string;
  description: string;
}

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

  /** The variables prompts may use; the backend is the single source. */
  async loadPlaceholders(): Promise<Placeholder[]> {
    const { data } = await getApiSettingsPlaceholders({ throwOnError: true });
    return data;
  }

  /** Names of the installed Ollama models. Rejects with the API's problem details (e.g. Ollama is down). */
  async loadModels(): Promise<string[]> {
    const { data } = await getApiLlmModels({ throwOnError: true });
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
