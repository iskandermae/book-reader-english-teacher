import { Injectable } from '@angular/core';
import { deleteApiBooksById, getApiBooks, postApiBooks } from '../api';

export interface BookSummary {
  id: number;
  title: string;
  chapterCount: number;
  importedAt: string;
  lastOpenedAt: string | null;
}

/** Thin wrapper over the generated client so components can be tested without HTTP. */
@Injectable({ providedIn: 'root' })
export class BooksService {
  async list(): Promise<BookSummary[]> {
    const { data } = await getApiBooks({ throwOnError: true });
    // The generated types allow number | string for int64 fields; normalise once here.
    return data.map((b) => ({ ...b, id: Number(b.id), chapterCount: Number(b.chapterCount) }));
  }

  /** Rejects with an Error whose message is the API's readable `detail`. The server merges the files in natural name order. */
  async import(files: File[], title: string): Promise<void> {
    const { error, response } = await postApiBooks({ body: { file: files, Title: title } });
    // Check the HTTP status, not just `error`: a failure with an empty body leaves `error` falsy.
    if (!response?.ok) {
      throw new Error(error?.detail ?? 'Could not import the book.');
    }
  }

  async delete(id: number): Promise<void> {
    const { error, response } = await deleteApiBooksById({ path: { id } });
    if (!response?.ok) {
      throw new Error(error?.detail ?? 'Could not delete the book.');
    }
  }
}
