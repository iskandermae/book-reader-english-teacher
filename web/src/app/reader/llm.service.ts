import { Injectable } from '@angular/core';
import { postApiLlmActionsById, postApiLlmExplain, postApiLlmTranslate } from '../api';
import { TextSelection } from './capture-selection';

/** The generated SSE endpoints share one request/response shape; this is what the helper needs from them. */
type StreamingCall = typeof postApiLlmTranslate;

/** Thin wrapper over the generated client so components can be tested without HTTP. */
@Injectable({ providedIn: 'root' })
export class LlmService {
  /** Streams the translation of `text` chunk by chunk (see `stream` for cancel and error behavior). */
  translate(selection: TextSelection, signal: AbortSignal): AsyncGenerator<string> {
    return this.stream(postApiLlmTranslate, selection, signal);
  }

  /** Streams a simple-English explanation of the selection in its sentence and paragraph. */
  explain(selection: TextSelection, signal: AbortSignal): AsyncGenerator<string> {
    return this.stream(postApiLlmExplain, selection, signal);
  }

  /** Streams the answer of a custom action (its saved prompt) for the selection. */
  runAction(id: number, selection: TextSelection, signal: AbortSignal): AsyncGenerator<string> {
    // Same body and response as Translate; only the URL carries the id.
    return this.stream((options) => postApiLlmActionsById({ ...options, path: { id } }), selection, signal);
  }

  /**
   * Shared SSE/error handling of all AI actions. Aborting `signal` ends the stream quietly.
   * Throws an Error with a readable message when the request is rejected or the model fails mid-stream.
   */
  private async *stream(call: StreamingCall, { text, context, paragraph }: TextSelection, signal: AbortSignal): AsyncGenerator<string> {
    let streamError: string | undefined; // `event: error` sent by the server after the stream started
    let requestError: string | undefined; // the request itself failed (400/503 problem details, network)
    const { stream } = await call({
      body: { text, context, paragraph },
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
