import { Injectable } from '@angular/core';
import { deleteApiLlmLog, getApiLlmLog } from '../api';

export interface LlmCallEntry {
  time: string;
  action: string;
  model: string;
  prompt: string;
  answer: string;
  durationMs: number;
  error: string | null;
}

/** Thin wrapper over the generated client so components can be tested without HTTP. */
@Injectable({ providedIn: 'root' })
export class LlmLogService {
  /** The last LLM calls, newest first. */
  async list(): Promise<LlmCallEntry[]> {
    const { data } = await getApiLlmLog({ throwOnError: true });
    // The generated types allow number | string for int64 fields; normalise once here.
    return data.map((e) => ({ ...e, durationMs: Number(e.durationMs) }));
  }

  async clear(): Promise<void> {
    await deleteApiLlmLog({ throwOnError: true });
  }
}
