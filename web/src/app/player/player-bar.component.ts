import { Component, ElementRef, HostListener, inject, input, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { AudioService } from '../audio/audio.service';
import { reportError } from '../report-error';
import { PLAYER_SPEEDS, DEFAULT_SPEED, PlayerSpeedService } from './player-speed.service';

const SKIP_SECONDS = 10;
/** While playing, the position is saved at most this often. */
const SAVE_INTERVAL_MS = 5000;
/** A saved position this close to the end (or the end itself) means "listened to the end": start again from 0. */
const RESTART_WITHIN_SECONDS = 2;

/** Ctrl+arrows edit text in these, so the player keys must leave them alone. */
function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Fixed bar at the bottom of the page: play/pause, seek, skip and speed for one audio source. */
@Component({
  selector: 'app-player-bar',
  styles: `
    :host { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; display: block; padding: 0.5rem 1rem;
            background: Canvas; color: CanvasText; border-top: 1px solid GrayText; }
    .controls { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    input[type=range] { flex: 1; min-width: 8rem; }
  `,
  template: `
    <audio #audio [src]="src()" preload="metadata"
           (loadedmetadata)="onMetadata()" (durationchange)="onMetadata()" (timeupdate)="onTime()"
           (play)="playing.set(true)" (pause)="onPause()" (ended)="onEnded()"
           (error)="onMediaError()"></audio>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    <div class="controls" role="group" aria-label="Audio player">
      <button type="button" (click)="skip(-skipSeconds)" [attr.aria-label]="'Back ' + skipSeconds + ' seconds'" title="Ctrl+Left">-{{ skipSeconds }} s</button>
      <button type="button" (click)="toggle()" title="Ctrl+Space">{{ playing() ? 'Pause' : 'Play' }}</button>
      <button type="button" (click)="skip(skipSeconds)" [attr.aria-label]="'Forward ' + skipSeconds + ' seconds'" title="Ctrl+Right">+{{ skipSeconds }} s</button>
      <span>{{ format(current()) }}</span>
      <input type="range" aria-label="Seek" min="0" [max]="duration()" step="1" [value]="current()"
             (input)="seek($any($event.target).valueAsNumber)" />
      <span>{{ format(duration()) }}</span>
      <label>Speed
        <select name="speed" (change)="chooseSpeed($any($event.target).value)">
          @for (s of speeds; track s) {
            <option [value]="s" [selected]="speed() === s">{{ s }}x</option>
          }
        </select>
      </label>
    </div>
  `,
})
export class PlayerBarComponent implements OnInit, OnDestroy {
  readonly src = input.required<string>();
  readonly bookId = input.required<number>();
  readonly audioId = input.required<number>();
  /** Saved position in seconds to resume from. */
  readonly startPosition = input(0);

  private readonly speedService = inject(PlayerSpeedService);
  private readonly audioService = inject(AudioService);
  private readonly audio = viewChild.required<ElementRef<HTMLAudioElement>>('audio');

  protected readonly speeds = PLAYER_SPEEDS;
  protected readonly skipSeconds = SKIP_SECONDS;
  protected readonly playing = signal(false);
  protected readonly current = signal(0);
  protected readonly duration = signal(0);
  protected readonly speed = signal<number>(DEFAULT_SPEED);
  protected readonly error = signal('');

  private positionRestored = false;
  private lastSavedPosition: number | null = null;
  private lastSaveAt = 0;
  private saveFailed = false;

  async ngOnInit(): Promise<void> {
    try {
      this.speed.set(await this.speedService.load());
      this.applySpeed();
    } catch (e) {
      // Playback still works at normal speed.
      this.error.set(reportError('Could not load your saved playback speed. Normal speed is used.', e));
    }
  }

  /**
   * Ctrl+Left / Ctrl+Right skip, Ctrl+Space toggles. Same handlers as the buttons, so position saving is identical.
   * HostListener is removed with the component, so the keys only work while the bar is shown.
   */
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey || isTextField(event.target)) return;
    if (event.key === 'ArrowLeft') this.skip(-SKIP_SECONDS);
    else if (event.key === 'ArrowRight') this.skip(SKIP_SECONDS);
    else if (event.key === ' ') {
      // Held keys repeat: toggle once only.
      if (!event.repeat) void this.toggle();
    } else return;
    event.preventDefault();
  }

  protected async toggle(): Promise<void> {
    const el = this.audio().nativeElement;
    if (!el.paused) {
      el.pause();
      return;
    }
    this.error.set('');
    try {
      await el.play();
    } catch (e) {
      this.error.set(reportError('Could not play this audio.', e));
    }
  }

  protected skip(seconds: number): void {
    const el = this.audio().nativeElement;
    this.seek(el.currentTime + seconds);
  }

  protected seek(seconds: number): void {
    const el = this.audio().nativeElement;
    // Clamp so a skip never leaves the file (duration is NaN until the metadata is loaded).
    el.currentTime = Math.min(Math.max(0, seconds), el.duration || seconds);
    this.current.set(el.currentTime);
    void this.savePosition();
  }

  protected async chooseSpeed(value: string): Promise<void> {
    this.speed.set(Number(value));
    this.applySpeed();
    this.error.set('');
    try {
      await this.speedService.save(this.speed());
    } catch (e) {
      this.error.set(`${reportError('Could not save your playback speed.', e)} The speed applies until you close the app.`);
    }
  }

  protected onMetadata(): void {
    const el = this.audio().nativeElement;
    this.duration.set(Number.isFinite(el.duration) ? el.duration : 0);
    this.applySpeed();
    this.restorePosition(el);
  }

  protected onTime(): void {
    const el = this.audio().nativeElement;
    this.current.set(el.currentTime);
    // Throttled: timeupdate fires several times a second.
    if (this.playing() && Date.now() - this.lastSaveAt >= SAVE_INTERVAL_MS) void this.savePosition();
  }

  protected onPause(): void {
    this.playing.set(false);
    void this.savePosition();
  }

  protected onEnded(): void {
    this.playing.set(false);
    void this.savePosition();
  }

  ngOnDestroy(): void {
    void this.savePosition();
  }

  protected onMediaError(): void {
    const code = this.audio().nativeElement.error;
    this.error.set(reportError('Could not load this audio.', new Error(code?.message || 'The audio file could not be loaded.')));
  }

  protected format(seconds: number): string {
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  /** Jumps to the saved position once, when the duration is first known. Not a user seek, so nothing is saved. */
  private restorePosition(el: HTMLAudioElement): void {
    if (this.positionRestored || !Number.isFinite(el.duration)) return;
    this.positionRestored = true;
    const start = this.startPosition();
    const nearEnd = start >= el.duration - RESTART_WITHIN_SECONDS;
    el.currentTime = nearEnd ? 0 : start;
    this.current.set(el.currentTime);
    this.lastSavedPosition = this.startPosition();
  }

  /**
   * Saves the current position. Failures only show a message: playback must keep working.
   * Nothing is sent before the saved position was restored (the element is still at 0) or when it did not change.
   */
  private async savePosition(): Promise<void> {
    if (!this.positionRestored) return;
    const position = this.audio().nativeElement.currentTime;
    if (position === this.lastSavedPosition) return;
    this.lastSaveAt = Date.now();
    this.lastSavedPosition = position;
    try {
      await this.audioService.savePosition(this.bookId(), this.audioId(), position);
      if (this.saveFailed) {
        // Only the save message is cleared; other errors (media, speed) stay.
        this.saveFailed = false;
        this.error.set('');
      }
    } catch (e) {
      // Retry on the next save.
      this.lastSavedPosition = null;
      this.saveFailed = true;
      this.error.set(reportError('Could not save the audio position.', e));
    }
  }

  private applySpeed(): void {
    this.audio().nativeElement.playbackRate = this.speed();
  }
}
