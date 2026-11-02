import { TestBed } from '@angular/core/testing';
import { client } from '../api/client.gen';
import { AudioService } from './audio.service';

// Mocks HTTP (fetch) rather than the generated functions, so the real client's response handling is exercised.
describe('AudioService', () => {
  const service = () => TestBed.inject(AudioService);
  const file = new File(['x'], 'a.mp3', { type: 'audio/mpeg' });

  function respond(status: number, body?: unknown) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        body === undefined
          ? new Response(null, { status })
          : new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
      ),
    );
  }

  beforeEach(() => client.setConfig({ baseUrl: 'http://localhost' }));
  afterEach(() => vi.restoreAllMocks());

  it('normalises numeric fields', async () => {
    respond(200, [{ id: '5', bookId: '1', fileName: 'a.mp3', contentType: 'audio/mpeg', sizeBytes: '2048', fromChapter: '0', toChapter: '3', positionSeconds: 12.5 }]);
    await expect(service().list(1)).resolves.toEqual([{ id: 5, fileName: 'a.mp3', sizeBytes: 2048, fromChapter: 0, toChapter: 3, positionSeconds: 12.5 }]);
  });

  it('builds the streaming URL of an audio file', () => {
    expect(service().contentUrl(1, 5)).toBe('http://localhost/api/books/1/audio/5/content');
  });

  it('uploads one multipart request with the file and range', async () => {
    const fetchMock = respond(200, {});
    await service().upload(1, file, 2, 4);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe('POST');
    expect(request.url).toBe('http://localhost/api/books/1/audio');
    // The multipart body is read as text: jsdom's File is not fetch's File, so the file part's content is not checked here.
    const body = await request.text();
    expect(body).toMatch(/name="FromChapter"\s+2\s/);
    expect(body).toMatch(/name="ToChapter"\s+4\s/);
    expect(body).toContain('name="file"');
  });

  it('sends the new range on update and calls DELETE on remove', async () => {
    const fetchMock = respond(204);
    await service().updateRange(1, 5, 1, 2);
    const put = fetchMock.mock.calls[0][0] as Request;
    expect([put.method, put.url]).toEqual(['PUT', 'http://localhost/api/books/1/audio/5']);
    expect(await put.json()).toEqual({ fromChapter: 1, toChapter: 2 });
    await service().remove(1, 5);
    expect((fetchMock.mock.calls[1][0] as Request).method).toBe('DELETE');
  });

  it('sends the position on save', async () => {
    const fetchMock = respond(204);
    await service().savePosition(1, 5, 42.5);
    const put = fetchMock.mock.calls[0][0] as Request;
    expect([put.method, put.url]).toEqual(['PUT', 'http://localhost/api/books/1/audio/5/position']);
    expect(await put.json()).toEqual({ positionSeconds: 42.5 });
  });

  it('rejects with the API detail', async () => {
    respond(400, { detail: 'The range overlaps another audio file.' });
    await expect(service().upload(1, file, 0, 1)).rejects.toThrow('The range overlaps another audio file.');
    await expect(service().updateRange(1, 5, 0, 1)).rejects.toThrow('The range overlaps another audio file.');
    await expect(service().remove(1, 5)).rejects.toThrow('The range overlaps another audio file.');
    await expect(service().savePosition(1, 5, -1)).rejects.toThrow('The range overlaps another audio file.');
  });

  it('rejects with a generic message when the failure has an empty body', async () => {
    respond(500);
    await expect(service().upload(1, file, 0, 1)).rejects.toThrow('Could not upload the audio file.');
    await expect(service().updateRange(1, 5, 0, 1)).rejects.toThrow('Could not change the chapter range.');
    await expect(service().remove(1, 5)).rejects.toThrow('Could not remove the audio file.');
    await expect(service().savePosition(1, 5, 1)).rejects.toThrow('Could not save the audio position.');
  });
});
