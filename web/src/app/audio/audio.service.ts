import { Injectable } from '@angular/core';
import {
  deleteApiBooksByBookIdAudioByAudioId,
  getApiBooksByBookIdAudio,
  postApiBooksByBookIdAudio,
  putApiBooksByBookIdAudioByAudioId,
} from '../api';

export interface AudioFile {
  id: number;
  fileName: string;
  sizeBytes: number;
  /** Zero-based chapter index, inclusive. */
  fromChapter: number;
  toChapter: number;
}

/** Thin wrapper over the generated client so components can be tested without HTTP. */
@Injectable({ providedIn: 'root' })
export class AudioService {
  async list(bookId: number): Promise<AudioFile[]> {
    const { data } = await getApiBooksByBookIdAudio({ path: { bookId }, throwOnError: true });
    // The generated types allow number | string for int64 fields; normalise once here.
    return data.map((a) => ({
      id: Number(a.id),
      fileName: a.fileName,
      sizeBytes: Number(a.sizeBytes),
      fromChapter: Number(a.fromChapter),
      toChapter: Number(a.toChapter),
    }));
  }

  /** The server accepts one file per request. Rejects with an Error whose message is the API's readable `detail`. */
  async upload(bookId: number, file: File, fromChapter: number, toChapter: number): Promise<void> {
    const { error, response } = await postApiBooksByBookIdAudio({
      path: { bookId },
      body: { file, FromChapter: fromChapter, ToChapter: toChapter },
    });
    // Check the HTTP status, not just `error`: a failure with an empty body leaves `error` falsy.
    if (!response?.ok) {
      throw new Error(error?.detail ?? 'Could not upload the audio file.');
    }
  }

  async updateRange(bookId: number, audioId: number, fromChapter: number, toChapter: number): Promise<void> {
    const { error, response } = await putApiBooksByBookIdAudioByAudioId({
      path: { bookId, audioId },
      body: { fromChapter, toChapter },
    });
    if (!response?.ok) {
      throw new Error(error?.detail ?? 'Could not change the chapter range.');
    }
  }

  async remove(bookId: number, audioId: number): Promise<void> {
    const { error, response } = await deleteApiBooksByBookIdAudioByAudioId({ path: { bookId, audioId } });
    if (!response?.ok) {
      throw new Error(error?.detail ?? 'Could not remove the audio file.');
    }
  }
}
