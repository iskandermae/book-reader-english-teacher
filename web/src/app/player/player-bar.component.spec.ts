import { TestBed } from '@angular/core/testing';
import { PlayerBarComponent } from './player-bar.component';
import { PlayerSpeedService } from './player-speed.service';

describe('PlayerBarComponent', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let speeds: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let play: ReturnType<typeof vi.spyOn>;
  let pause: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // jsdom does not play media; the element's methods are replaced and its state is set by the tests.
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    speeds = { load: vi.fn().mockResolvedValue(1), save: vi.fn().mockResolvedValue(undefined) };
    TestBed.configureTestingModule({ providers: [{ provide: PlayerSpeedService, useValue: speeds }] });
  });
  afterEach(() => vi.restoreAllMocks());

  async function create() {
    const fixture = TestBed.createComponent(PlayerBarComponent);
    fixture.componentRef.setInput('src', '/audio.mp3');
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
});
