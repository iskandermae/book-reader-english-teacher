import { Injectable } from '@angular/core';
import { getApiActions, putApiActions } from '../api';

/** A user-defined AI action. `id` is missing until the server has saved it. */
export interface CustomAction {
  id?: number;
  name: string;
  prompt: string;
}

/** Thin wrapper over the generated client so components can be tested without HTTP. */
@Injectable({ providedIn: 'root' })
export class ActionsService {
  async load(): Promise<CustomAction[]> {
    const { data } = await getApiActions({ throwOnError: true });
    return data.map(toAction);
  }

  /** Replaces the whole list. Rejects with an Error whose message is the API's readable `detail`. */
  async save(actions: CustomAction[]): Promise<CustomAction[]> {
    const { data, error } = await putApiActions({ body: actions });
    if (error || !data) {
      throw new Error(error?.detail ?? 'Could not save the custom actions.');
    }
    return data.map(toAction);
  }
}

// The generated DTO types the 64-bit id as number | string; the run endpoint takes a number.
const toAction = ({ id, name, prompt }: { id: number | string; name: string; prompt: string }): CustomAction => ({
  id: Number(id),
  name,
  prompt,
});
