import { Injectable } from '@angular/core';
import { postApiLlmTranslate } from '../api';

/** Thin wrapper over the generated client so components can be tested without HTTP. */
@Injectable({ providedIn: 'root' })
export class LlmService {
  /**
   * Streams the translation of `text` chunk by chunk. Aborting `signal` ends the stream quietly.
   * Throws an Error with a readable message when the request is rejected or the model fails mid-stream.
   */
  async *translate(text: string, context: string, signal: AbortSignal): AsyncGenerator<string> {
    let streamError: string | undefined; // `event: error` sent by the server after the stream started
    let requestError: string | undefined; // the request itself failed (400/503 problem details, network)
    const { stream } = await postApiLlmTranslate({
      body: { text, context },
      signal,
      // The generated client hides the response body of a failed request, so read the problem details here.
      fetch: async (...args: Parameters<typeof fetch>) => {
        try {
          const response = await fetch(...args);
          if (!response.ok) {
            const problem = await response.json().catch(() => null);
            requestError = problem?.detail ?? 'The AI request failed.';
          }
          return response;
        } catch (e) {
          requestError = 'Could not reach the server.';
          throw e;
        }
      },
      // The client retries a failed connection forever by default; one attempt is enough here.
      sseMaxRetryAttempts: 1,
      onSseEvent: (event) => {
        if (event.event === 'error') streamError = String(event.data);
      },
    });
    for await (const chunk of stream) {
      if (streamError !== undefined) throw new Error(streamError);
      if (chunk) yield chunk; // the final `done` event carries an empty chunk
    }
    if (signal.aborted) return;
    if (requestError !== undefined) throw new Error(requestError);
  }
}
