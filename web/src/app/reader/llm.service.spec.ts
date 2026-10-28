import { LlmService } from './llm.service';

const sse = (...parts: string[]) =>
  new Response(parts.join(''), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
const problem = (status: number, detail: string) =>
  new Response(JSON.stringify({ detail }), { status, headers: { 'Content-Type': 'application/problem+json' } });

describe.each([
  ['translate', '/api/llm/translate'],
  ['explain', '/api/llm/explain'],
] as const)('LlmService.%s', (method, path) => {
  const service = new LlmService();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  async function collect(signal = new AbortController().signal) {
    const chunks: string[] = [];
    for await (const c of service[method]({ text: 'hello', context: 'hello world.', paragraph: 'hello world. More.' }, signal)) chunks.push(c);
    return chunks;
  }

  it('yields the chunks and skips the final done event', async () => {
    fetchMock.mockResolvedValue(sse('data: "He"\n\n', 'data: "llo"\n\n', 'event: done\ndata: \n\n'));
    expect(await collect()).toEqual(['He', 'llo']);
    const request: Request = fetchMock.mock.calls[0][0];
    expect(new URL(request.url).pathname).toBe(path);
    expect(await request.json()).toEqual({ text: 'hello', context: 'hello world.', paragraph: 'hello world. More.' });
  });

  it('throws the problem detail of a rejected request', async () => {
    fetchMock.mockResolvedValue(problem(503, 'Ollama is not running. Start it.'));
    await expect(collect()).rejects.toThrow('Ollama is not running. Start it.');
  });

  it('throws the message of an error event sent mid-stream', async () => {
    fetchMock.mockResolvedValue(sse('data: "He"\n\n', 'event: error\ndata: "Model crashed"\n\n'));
    await expect(collect()).rejects.toThrow('Model crashed');
  });

  it('ends quietly when aborted', async () => {
    const abort = new AbortController();
    fetchMock.mockImplementation(async () => {
      abort.abort();
      throw new DOMException('aborted', 'AbortError');
    });
    expect(await collect(abort.signal)).toEqual([]);
  });
});

describe('LlmService.runAction', () => {
  // Failures are logged on purpose; keep the test output clean and let tests assert on it.
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => consoleError.mockRestore());

  afterEach(() => vi.unstubAllGlobals());

  it('posts to the action id with the selection and streams the chunks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sse('data: "Hi"\n\n', 'event: done\ndata: \n\n'));
    vi.stubGlobal('fetch', fetchMock);
    const chunks: string[] = [];
    for await (const c of new LlmService().runAction(7, { text: 'a', context: 'b', paragraph: 'c' }, new AbortController().signal)) chunks.push(c);
    expect(chunks).toEqual(['Hi']);
    const request: Request = fetchMock.mock.calls[0][0];
    expect(new URL(request.url).pathname).toBe('/api/llm/actions/7');
    expect(await request.json()).toEqual({ text: 'a', context: 'b', paragraph: 'c' });
  });
});
