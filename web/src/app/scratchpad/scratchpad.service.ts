import { Injectable } from '@angular/core';
import { getApiScratchpad, putApiScratchpad } from '../api';

/** Thin wrapper over the generated client so components can be tested without HTTP. */
@Injectable({ providedIn: 'root' })
export class ScratchpadService {
  async load(): Promise<string> {
    const { data } = await getApiScratchpad({ throwOnError: true });
    return data.text;
  }

  /** Rejects with an Error whose message is the API's readable `detail`. */
  async save(text: string): Promise<void> {
    const { error, response } = await putApiScratchpad({ body: { text } });
    // Check the HTTP status, not just `error`: a failure with an empty body leaves `error` falsy.
    if (!response?.ok) {
      throw new Error(error?.detail ?? 'Could not save the text.');
    }
  }
}
