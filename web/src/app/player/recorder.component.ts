import { Component, ElementRef, HostListener, OnDestroy, output, signal, viewChild } from '@angular/core';
import { reportError } from '../report-error';
import { isTextField } from './text-field';

/** Speech is recorded as Opus; the first type the browser supports is used (Chrome/Firefox: webm, Safari: mp4). */
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
/** The browser default is low (about 32 kbps in Chrome) and sounds muffled on replay. */
const BITS_PER_SECOND = 128_000;
/** Echo cancellation, noise suppression and auto gain are made for calls and distort a voice take. */
const RAW_MIC = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

/** Recording stays in the browser: only the last take is kept, as a blob URL. Nothing is uploaded. */
@Component({
  selector: 'app-recorder',
  template: `
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    <span role="group" aria-label="Voice recorder">
      @if (recording()) {
        <button type="button" (click)="stop()" title="Ctrl+Enter" aria-keyshortcuts="Control+Enter">Stop recording</button>
      } @else {
        <button type="button" [disabled]="starting()" (click)="start()" title="Ctrl+Enter" aria-keyshortcuts="Control+Enter">Record</button>
      }
      @if (takeUrl()) {
        @if (playingTake()) {
          <button type="button" (click)="stopTake()" title="Ctrl+Up" aria-keyshortcuts="Control+ArrowUp">Stop my recording</button>
        } @else {
          <button type="button" [disabled]="recording()" (click)="playTake()" title="Ctrl+Up" aria-keyshortcuts="Control+ArrowUp">Play my recording</button>
        }
      }
    </span>
    <audio #take [attr.src]="takeUrl()" (ended)="playingTake.set(false)" (pause)="playingTake.set(false)"></audio>
  `,
})
export class RecorderComponent implements OnDestroy {
  /** Emitted when the microphone is open and recording begins, so the host can pause other audio. */
  readonly started = output<void>();

  protected readonly starting = signal(false);
  protected readonly recording = signal(false);
  protected readonly playingTake = signal(false);
  protected readonly takeUrl = signal<string | null>(null);
  protected readonly error = signal('');

  private readonly take = viewChild.required<ElementRef<HTMLAudioElement>>('take');
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private destroyed = false;

  /**
   * Ctrl+Enter starts / stops recording, Ctrl+ArrowUp plays / stops the take. Same handlers as the buttons.
   * The player bar uses Ctrl+Left / Right / Space, so the keys do not clash.
   */
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey || isTextField(event.target)) return;
    if (event.key === 'Enter') {
      // Held keys repeat: act once only. Ignored while the microphone permission is pending.
      if (!event.repeat && !this.starting()) void (this.recording() ? this.stop() : this.start());
    } else if (event.key === 'ArrowUp') {
      if (!event.repeat && this.takeUrl() && !this.recording()) void (this.playingTake() ? this.stopTake() : this.playTake());
    } else return;
    // Ctrl+Enter on a focused button would also click it, which must not run the action twice.
    event.preventDefault();
  }

  protected async start(): Promise<void> {
    this.error.set('');
    this.stopTake();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.error.set(clearMessage('Recording is not supported in this browser.', new Error('MediaRecorder or getUserMedia is missing.')));
      return;
    }
    this.starting.set(true);
    let stream: MediaStream;
    try {
      stream = await openMic();
    } catch (e) {
      this.error.set(micMessage(e));
      return;
    } finally {
      this.starting.set(false);
    }
    if (this.destroyed) {
      // The user left while the browser asked for permission: do not keep the microphone open.
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.begin(stream);
  }

  protected stop(): void {
    // The `stop` event finishes the take and releases the microphone.
    if (this.recorder?.state === 'recording') this.recorder.stop();
  }

  protected async playTake(): Promise<void> {
    this.error.set('');
    try {
      await this.take().nativeElement.play();
      this.playingTake.set(true);
    } catch (e) {
      this.error.set(reportError('Could not play your recording.', e));
    }
  }

  protected stopTake(): void {
    const el = this.take().nativeElement;
    el.pause();
    el.currentTime = 0;
    this.playingTake.set(false);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.release();
    this.revokeTake();
  }

  private begin(stream: MediaStream): void {
    const chunks: Blob[] = [];
    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: BITS_PER_SECOND });
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onerror = (e) => {
      this.error.set(reportError('The recording failed.', (e as ErrorEvent).error ?? new Error('The recorder reported an error.')));
      this.release();
    };
    recorder.onstop = () => {
      this.release();
      if (this.destroyed || !chunks.length) return;
      // A new take replaces the previous one.
      this.revokeTake();
      this.takeUrl.set(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType })));
    };
    this.stream = stream;
    this.recorder = recorder;
    recorder.start();
    this.recording.set(true);
    this.started.emit();
  }

  /** Stops the microphone tracks (the browser's recording indicator goes off). */
  private release(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.recording.set(false);
  }

  private revokeTake(): void {
    const url = this.takeUrl();
    if (url) URL.revokeObjectURL(url);
    this.takeUrl.set(null);
  }
}

/** Asks for an unprocessed microphone; if the device rejects those constraints, falls back to the defaults. */
async function openMic(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: RAW_MIC });
  } catch (e) {
    if ((e as { name?: string } | null)?.name !== 'OverconstrainedError') throw e;
    console.warn('The microphone rejected the quality settings. Using the default settings.', e);
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

/** Shows the clear text (the browser's own is vague) and logs the real error. */
function clearMessage(text: string, e: unknown): string {
  console.error(text, e);
  return text;
}

function micMessage(e: unknown): string {
  const name = (e as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return clearMessage('Microphone access was denied. Allow it in the browser site settings and try again.', e);
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return clearMessage('No microphone was found. Connect one and try again.', e);
  }
  return reportError('Could not start the microphone.', e);
}
