import { TestBed } from '@angular/core/testing';
import { RecorderComponent } from './recorder.component';

/** Fake recorder: the tests fire its events by hand, no real microphone is used. */
class FakeRecorder {
  static last: FakeRecorder;
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  static supported = ['audio/webm;codecs=opus', 'audio/mp4'];
  static isTypeSupported = (type: string) => FakeRecorder.supported.includes(type);
  constructor(public stream: MediaStream, public options?: { mimeType?: string; audioBitsPerSecond?: number }) {
    FakeRecorder.last = this;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['x']) });
    this.onstop?.();
  }
}

describe('RecorderComponent', () => {
  let getUserMedia: ReturnType<typeof vi.fn>;
  let track: { stop: ReturnType<typeof vi.fn> };
  let urls = 0;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    FakeRecorder.supported = ['audio/webm;codecs=opus', 'audio/mp4'];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    track = { stop: vi.fn() };
    getUserMedia = vi.fn().mockImplementation(async () => ({ getTracks: () => [track] }));
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    urls = 0;
    URL.createObjectURL = vi.fn(() => `blob:take-${++urls}`);
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function create() {
    const fixture = TestBed.createComponent(RecorderComponent);
    const started = vi.fn();
    fixture.componentInstance.started.subscribe(started);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === text) ?? null;
    const settle = async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, el, button, settle, started };
  }

  it('records, stops, releases the microphone and offers playback', async () => {
    const { button, settle, started } = await create();
    expect(button('Play my recording')).toBeNull();
    button('Record')!.click();
    await settle();
    expect(started).toHaveBeenCalled();
    expect(button('Stop recording')).not.toBeNull();

    button('Stop recording')!.click();
    await settle();
    expect(track.stop).toHaveBeenCalled();
    expect(button('Record')).not.toBeNull();
    expect(button('Play my recording')).not.toBeNull();
  });

  it('plays and stops the own recording', async () => {
    const { button, el, settle } = await create();
    button('Record')!.click();
    await settle();
    button('Stop recording')!.click();
    await settle();
    expect(el.querySelector('audio')!.getAttribute('src')).toBe('blob:take-1');

    button('Play my recording')!.click();
    await settle();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    button('Stop my recording')!.click();
    await settle();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(button('Play my recording')).not.toBeNull();
  });

  it('replaces the previous take and revokes its URL', async () => {
    const { button, el, settle } = await create();
    for (let i = 0; i < 2; i++) {
      button('Record')!.click();
      await settle();
      button('Stop recording')!.click();
      await settle();
    }
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:take-1');
    expect(el.querySelector('audio')!.getAttribute('src')).toBe('blob:take-2');
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'No microphone was found'],
  ])('shows a clear message and logs on %s', async (name, text) => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('browser text'), { name }));
    const { el, button, settle } = await create();
    button('Record')!.click();
    await settle();
    expect(el.querySelector('[role=alert]')!.textContent).toContain(text);
    expect(console.error).toHaveBeenCalled();
    expect(button('Record')).not.toBeNull();
  });

  it('shows the error for an unexpected microphone failure', async () => {
    getUserMedia.mockRejectedValue(new Error('Device busy'));
    const { el, button, settle } = await create();
    button('Record')!.click();
    await settle();
    expect(el.querySelector('[role=alert]')!.textContent).toContain('Device busy');
  });

  it('shows a message when recording is not supported', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const { el, button, settle } = await create();
    button('Record')!.click();
    await settle();
    expect(el.querySelector('[role=alert]')!.textContent).toContain('not supported');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('asks for an unprocessed microphone and records Opus at a good bitrate', async () => {
    const { button, settle } = await create();
    button('Record')!.click();
    await settle();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    expect(FakeRecorder.last.options).toEqual({ mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128_000 });
  });

  it('falls back to the next supported mime type, or the browser default', async () => {
    FakeRecorder.supported = ['audio/mp4'];
    const first = await create();
    first.button('Record')!.click();
    await first.settle();
    expect(FakeRecorder.last.options?.mimeType).toBe('audio/mp4');

    FakeRecorder.supported = [];
    const second = await create();
    second.button('Record')!.click();
    await second.settle();
    expect(FakeRecorder.last.options?.mimeType).toBeUndefined();
  });

  it('retries with default microphone settings when the constraints are rejected', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('constraints'), { name: 'OverconstrainedError' }));
    const { el, button, settle } = await create();
    button('Record')!.click();
    await settle();
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: true });
    expect(button('Stop recording')).not.toBeNull();
    expect(el.querySelector('[role=alert]')).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  describe('hotkeys', () => {
    const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) => {
      const event = new KeyboardEvent('keydown', { key, shiftKey: true, bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };

    it('Shift+Space starts and stops recording', async () => {
      const { button, settle } = await create();
      expect(press(' ').defaultPrevented).toBe(true);
      await settle();
      expect(button('Stop recording')).not.toBeNull();
      press(' ');
      await settle();
      expect(button('Record')).not.toBeNull();
      expect(button('Play my recording')).not.toBeNull();
    });

    it('Shift+ArrowRight plays and stops the take only when one exists and not recording', async () => {
      const { button, settle } = await create();
      press('ArrowRight');
      expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

      press(' ');
      await settle();
      press('ArrowRight'); // still recording
      expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
      press(' ');
      await settle();

      press('ArrowRight');
      await settle();
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
      expect(button('Stop my recording')).not.toBeNull();
      press('ArrowRight');
      await settle();
      expect(button('Play my recording')).not.toBeNull();
    });

    it('ignores key repeat, text fields, other modifiers and the player bar keys', async () => {
      const { settle } = await create();
      const input = document.body.appendChild(document.createElement('input'));
      press(' ', { repeat: true }); // swallowed (no button click), but starts nothing
      expect(press(' ', {}, input).defaultPrevented).toBe(false);
      expect(press(' ', { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(press(' ', { shiftKey: false }).defaultPrevented).toBe(false);
      for (const key of ['ArrowLeft', 'ArrowUp', 'Enter']) expect(press(key).defaultPrevented).toBe(false);
      await settle();
      expect(getUserMedia).not.toHaveBeenCalled();
      input.remove();
    });
  });

  it('stops recording and releases the microphone when destroyed', async () => {
    const { fixture, button, settle } = await create();
    button('Record')!.click();
    await settle();
    fixture.destroy();
    expect(FakeRecorder.last.state).toBe('inactive');
    expect(track.stop).toHaveBeenCalled();
  });
});
