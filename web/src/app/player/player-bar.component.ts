import { Component, ElementRef, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { reportError } from '../report-error';
import { PLAYER_SPEEDS, DEFAULT_SPEED, PlayerSpeedService } from './player-speed.service';

const SKIP_SECONDS = 10;

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
           (play)="playing.set(true)" (pause)="playing.set(false)" (ended)="playing.set(false)"
           (error)="onMediaError()"></audio>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    <div class="controls" role="group" aria-label="Audio player">
      <button type="button" (click)="skip(-skipSeconds)" [attr.aria-label]="'Back ' + skipSeconds + ' seconds'">-{{ skipSeconds }} s</button>
      <button type="button" (click)="toggle()">{{ playing() ? 'Pause' : 'Play' }}</button>
      <button type="button" (click)="skip(skipSeconds)" [attr.aria-label]="'Forward ' + skipSeconds + ' seconds'">+{{ skipSeconds }} s</button>
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
export class PlayerBarComponent implements OnInit {
  readonly src = input.required<string>();

  private readonly speedService = inject(PlayerSpeedService);
  private readonly audio = viewChild.required<ElementRef<HTMLAudioElement>>('audio');

  protected readonly speeds = PLAYER_SPEEDS;
  protected readonly skipSeconds = SKIP_SECONDS;
  protected readonly playing = signal(false);
  protected readonly current = signal(0);
  protected readonly duration = signal(0);
  protected readonly speed = signal<number>(DEFAULT_SPEED);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.speed.set(await this.speedService.load());
      this.applySpeed();
    } catch (e) {
      // Playback still works at normal speed.
      this.error.set(reportError('Could not load your saved playback speed. Normal speed is used.', e));
    }
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
  }

  protected onTime(): void {
    this.current.set(this.audio().nativeElement.currentTime);
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

  private applySpeed(): void {
    this.audio().nativeElement.playbackRate = this.speed();
  }
}
