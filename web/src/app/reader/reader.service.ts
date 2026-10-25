import { Injectable } from '@angular/core';
import {
  getApiBooksByIdChapters,
  getApiBooksByIdChaptersByIndex,
  getApiBooksByIdPosition,
  putApiBooksByIdPosition,
} from '../api';

export interface ChapterSummary {
  index: number;
  title: string;
}

export interface BookChapters {
  title: string;
  chapters: ChapterSummary[];
}

export interface Chapter {
  title: string;
  paragraphs: string[];
}

export interface ReadingPosition {
  chapterIndex: number;
  paragraphIndex: number;
}

/** Thin wrapper over the generated client so the reader can be tested without HTTP. */
@Injectable({ providedIn: 'root' })
export class ReaderService {
  async chapters(bookId: number): Promise<BookChapters> {
    const { data } = await getApiBooksByIdChapters({ path: { id: bookId }, throwOnError: true });
    // The generated types allow number | string for int64 fields; normalise once here.
    return { title: data.title, chapters: data.chapters.map((c) => ({ index: Number(c.index), title: c.title })) };
  }

  async chapter(bookId: number, index: number): Promise<Chapter> {
    const { data } = await getApiBooksByIdChaptersByIndex({ path: { id: bookId, index }, throwOnError: true });
    return { title: data.title, paragraphs: data.paragraphs };
  }

  async position(bookId: number): Promise<ReadingPosition> {
    const { data } = await getApiBooksByIdPosition({ path: { id: bookId }, throwOnError: true });
    return { chapterIndex: Number(data.chapterIndex), paragraphIndex: Number(data.paragraphIndex) };
  }

  async savePosition(bookId: number, position: ReadingPosition): Promise<void> {
    await putApiBooksByIdPosition({ path: { id: bookId }, body: position, throwOnError: true });
  }
}
