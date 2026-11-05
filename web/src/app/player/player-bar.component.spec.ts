import { TestBed } from '@angular/core/testing';
import { PlayerBarComponent } from './player-bar.component';
import { AudioService } from '../audio/audio.service';
import { PlayerSpeedService } from './player-speed.service';

describe('PlayerBarComponent', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let speeds: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let audioApi: { savePosition: ReturnType<typeof vi.fn> };
  let play: ReturnType<typeof vi.spyOn>;
  let pause: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // jsdom does not play media; the element's methods are replaced and its state is set by the tests.
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    speeds = { load: vi.fn().mockResolvedValue(1), save: vi.fn().mockResolvedValue(undefined) };
    audioApi = { savePosition: vi.fn().mockResolvedValue(undefined) };
    TestBed.configureTestingModule({
      providers: [{ provide: PlayerSpeedService, useValue: speeds }, { provide: AudioService, useValue: audioApi }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function create(startPosition = 0) {
    const fixture = TestBed.createComponent(PlayerBarComponent);
    fixture.componentRef.setInput('src', '/audio.mp3');
    fixture.componentRef.setInput('bookId', 3);
    fixture.componentRef.setInput('audioId', 9);
    fixture.componentRef.setInput('startPosition', startPosition);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const audio = el.querySelector('audio')!;
    // The browser sets the duration after loading the file.
    Object.defineProperty(audio, 'duration', { value: 100, configurable: true });
    audio.dispatchEvent(new Event('loadedmetadata'));
    fixture.detectChanges();
    const button = (text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === text)!;
    return { fixture, el, audio, button };
  }

  it('uses the source and shows the total time', async () => {
    const { el, audio } = await create();
    expect(audio.getAttribute('src')).toBe('/audio.mp3');
    expect(el.textContent).toContain('0:00');
    expect(el.textContent).toContain('1:40');
  });

  it('plays and pauses, and the button follows the element state', async () => {
    const { fixture, audio, button } = await create();
    button('Play').click();
    expect(play).toHaveBeenCalled();
    audio.dispatchEvent(new Event('play'));
    fixture.detectChanges();
    Object.defineProperty(audio, 'paused', { value: false, configurable: true });
    button('Pause').click();
    expect(pause).toHaveBeenCalled();
  });

  it('skips back and forward by 10 s, never below 0 or past the end', async () => {
    const { audio, button } = await create();
    audio.currentTime = 50;
    button('+10 s').click();
    expect(audio.currentTime).toBe(60);
    button('-10 s').click();
    expect(audio.currentTime).toBe(50);
    audio.currentTime = 5;
    button('-10 s').click();
    expect(audio.currentTime).toBe(0);
    audio.currentTime = 95;
    button('+10 s').click();
    expect(audio.currentTime).toBe(100);
  });

  it('seeks with the seek bar and shows the current time', async () => {
    const { fixture, el, audio } = await create();
    const range = el.querySelector<HTMLInputElement>('input[type=range]')!;
    range.value = '75';
    range.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(audio.currentTime).toBe(75);
    expect(el.textContent).toContain('1:15');
  });

  it('applies the saved speed on open', async () => {
    speeds.load.mockResolvedValue(1.5);
    const { el, audio } = await create();
    expect(audio.playbackRate).toBe(1.5);
    expect(el.querySelector<HTMLSelectElement>('select')!.value).toBe('1.5');
  });

  it('applies and saves the chosen speed', async () => {
    const { el, audio } = await create();
    const select = el.querySelector<HTMLSelectElement>('select')!;
    select.value = '0.75';
    select.dispatchEvent(new Event('change'));
    expect(audio.playbackRate).toBe(0.75);
    expect(speeds.save).toHaveBeenCalledWith(0.75);
  });

  it('shows a message when the speed cannot be saved, and keeps the new speed', async () => {
    speeds.save.mockRejectedValue(new Error('disk full'));
    const { fixture, el, audio } = await create();
    const select = el.querySelector<HTMLSelectElement>('select')!;
    select.value = '1.25';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')!.textContent).toContain('disk full');
    expect(audio.playbackRate).toBe(1.25);
    expect(consoleError).toHaveBeenCalled();
  });

  it('shows a message and plays at normal speed when the saved speed cannot be loaded', async () => {
    speeds.load.mockRejectedValue(new Error('no settings'));
    const { el, audio } = await create();
    expect(el.querySelector('[role=alert]')!.textContent).toContain('no settings');
    expect(audio.playbackRate).toBe(1);
  });

  it('shows a message when playing fails', async () => {
    play.mockRejectedValue(new Error('not allowed'));
    const { fixture, el, button } = await create();
    button('Play').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')!.textContent).toContain('not allowed');
  });

  it('shows a message when the file cannot be loaded', async () => {
    const { fixture, el, audio } = await create();
    audio.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')).not.toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });

  describe('hot keys', () => {
    function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
      const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    }

    it('Ctrl+Left and Ctrl+Right skip 10 s and prevent the browser default', async () => {
      const { audio } = await create();
      audio.currentTime = 50;
      expect(press('ArrowRight').defaultPrevented).toBe(true);
      expect(audio.currentTime).toBe(60);
      press('ArrowLeft');
      expect(audio.currentTime).toBe(50);
    });

    it('Ctrl+Space toggles play/pause, once per key press', async () => {
      const { audio } = await create();
      expect(press(' ').defaultPrevented).toBe(true);
      expect(play).toHaveBeenCalledTimes(1);
      press(' ', { repeat: true });
      expect(play).toHaveBeenCalledTimes(1);
      Object.defineProperty(audio, 'paused', { value: false, configurable: true });
      press(' ');
      expect(pause).toHaveBeenCalledTimes(1);
    });

    it('saves the position like the buttons', async () => {
      const { audio } = await create();
      audio.currentTime = 50;
      press('ArrowRight');
      expect(audioApi.savePosition).toHaveBeenCalledWith(3, 9, 60);
    });

    it('is ignored in text fields, with other modifiers, without Ctrl and for other keys', async () => {
      const { audio } = await create();
      audio.currentTime = 50;
      for (const tag of ['input', 'textarea', 'select']) {
        const field = document.body.appendChild(document.createElement(tag));
        expect(press('ArrowRight', {}, field).defaultPrevented).toBe(false);
        field.remove();
      }
      const editable = document.body.appendChild(document.createElement('div'));
      // jsdom does not implement isContentEditable.
      Object.defineProperty(editable, 'isContentEditable', { value: true });
      press('ArrowRight', {}, editable);
      editable.remove();
      press('ArrowRight', { shiftKey: true });
      press('ArrowRight', { altKey: true });
      press('ArrowRight', { ctrlKey: false });
      press('a');
      expect(audio.currentTime).toBe(50);
      expect(play).not.toHaveBeenCalled();
    });

    it('stops listening when the player is destroyed', async () => {
      const { fixture, audio } = await create();
      audio.currentTime = 50;
      fixture.destroy();
      expect(press('ArrowRight').defaultPrevented).toBe(false);
      expect(audio.currentTime).toBe(50);
    });

    it('shows the shortcuts in the button tooltips', async () => {
      const { button } = await create();
      expect(button('-10 s').title).toBe('Ctrl+Left');
      expect(button('Play').title).toBe('Ctrl+Space');
      expect(button('+10 s').title).toBe('Ctrl+Right');
    });
  });

  describe('remembering the position', () => {
    // Plays the element at `time` and fires the browser's timeupdate.
    function tick(audio: HTMLAudioElement, time: number) {
      audio.currentTime = time;
      audio.dispatchEvent(new Event('timeupdate'));
    }

    beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
    afterEach(() => vi.useRealTimers());

    it('saves while playing at most every 5 s', async () => {
      const { audio } = await create();
      audio.dispatchEvent(new Event('play'));
      vi.setSystemTime(Date.now() + 5000);
      tick(audio, 10);
      expect(audioApi.savePosition).toHaveBeenCalledTimes(1);
      expect(audioApi.savePosition).toHaveBeenLastCalledWith(3, 9, 10);
      vi.advanceTimersByTime(4000);
      tick(audio, 14);
      expect(audioApi.savePosition).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1000);
      tick(audio, 15);
      expect(audioApi.savePosition).toHaveBeenCalledTimes(2);
      expect(audioApi.savePosition).toHaveBeenLastCalledWith(3, 9, 15);
    });

    it('does not save time updates while paused', async () => {
      const { audio } = await create();
      vi.setSystemTime(Date.now() + 10000);
      tick(audio, 10);
      expect(audioApi.savePosition).not.toHaveBeenCalled();
    });

    it('saves on pause, on seek and when the component is destroyed', async () => {
      const { fixture, audio, button } = await create();
      audio.currentTime = 20;
      audio.dispatchEvent(new Event('pause'));
      expect(audioApi.savePosition).toHaveBeenLastCalledWith(3, 9, 20);
      button('+10 s').click();
      expect(audioApi.savePosition).toHaveBeenLastCalledWith(3, 9, 30);
      audio.currentTime = 40;
      fixture.destroy();
      expect(audioApi.savePosition).toHaveBeenLastCalledWith(3, 9, 40);
      expect(audioApi.savePosition).toHaveBeenCalledTimes(3);
    });

    it('does not save an unchanged position', async () => {
      const { fixture, audio } = await create();
      audio.dispatchEvent(new Event('pause'));
      fixture.destroy();
      expect(audioApi.savePosition).not.toHaveBeenCalled();
    });

    it('starts at the saved position without saving it again', async () => {
      const { audio, el } = await create(42);
      expect(audio.currentTime).toBe(42);
      expect(el.textContent).toContain('0:42');
      audio.dispatchEvent(new Event('pause'));
      expect(audioApi.savePosition).not.toHaveBeenCalled();
    });

    it('starts from 0 when the saved position is within 2 s of the end or past it', async () => {
      expect((await create(98)).audio.currentTime).toBe(0);
      expect((await create(100)).audio.currentTime).toBe(0);
      expect((await create(97.9)).audio.currentTime).toBe(97.9);
    });

    it('shows a message but keeps playing when saving fails, and retries on the next save', async () => {
      audioApi.savePosition.mockRejectedValueOnce(new Error('server down'));
      const { fixture, el, audio } = await create();
      audio.currentTime = 20;
      audio.dispatchEvent(new Event('pause'));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('[role=alert]')!.textContent).toContain('server down');
      expect(consoleError).toHaveBeenCalled();
      audio.dispatchEvent(new Event('pause'));
      expect(audioApi.savePosition).toHaveBeenCalledTimes(2);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('[role=alert]')).toBeNull();
    });

    it('saves when the file ends', async () => {
      const { audio } = await create();
      audio.currentTime = 100;
      audio.dispatchEvent(new Event('ended'));
      expect(audioApi.savePosition).toHaveBeenCalledWith(3, 9, 100);
    });
  });

  it('pauses the audio when the host asks (a recording starts)', async () => {
    const { fixture } = await create();
    pause.mockClear();
    fixture.componentInstance.pause();
    expect(pause).toHaveBeenCalled();
  });
});
