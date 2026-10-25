import { TestBed } from '@angular/core/testing';
import { client } from '../api/client.gen';
import { BooksService } from './books.service';

// Mocks HTTP (fetch) rather than the generated functions, so the real client's response handling is exercised.
describe('BooksService', () => {
  const service = () => TestBed.inject(BooksService);
  const file = new File(['x'], 'a.txt');

  function respond(status: number, body?: unknown) {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        body === undefined
          ? new Response(null, { status })
          : new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
      ),
    );
  }

  beforeEach(() => client.setConfig({ baseUrl: 'http://localhost' }));
  afterEach(() => vi.restoreAllMocks());

  it('normalises id and chapter count to numbers', async () => {
    respond(200, [{ id: '7', title: 'T', chapterCount: '3', importedAt: 'x', lastOpenedAt: null }]);
    const [book] = await service().list();
    expect(book.id).toBe(7);
    expect(book.chapterCount).toBe(3);
  });

  it('resolves import and delete on success', async () => {
    respond(200, { id: 1, title: 'T', chapterCount: 1 });
    await expect(service().import(file, 't')).resolves.toBeUndefined();
    respond(204);
    await expect(service().delete(1)).resolves.toBeUndefined();
  });

  it('rejects with the API detail', async () => {
    respond(400, { detail: 'The file is empty.' });
    await expect(service().import(file, 't')).rejects.toThrow('The file is empty.');
    respond(404, { detail: 'No such book.' });
    await expect(service().delete(1)).rejects.toThrow('No such book.');
  });

  it('rejects with a generic message when the failure has an empty body', async () => {
    respond(500);
    await expect(service().import(file, 't')).rejects.toThrow('Could not import the book.');
    respond(404);
    await expect(service().delete(1)).rejects.toThrow('Could not delete the book.');
  });
});
