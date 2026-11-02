import { Injectable, inject } from '@angular/core';
import { SettingsService } from '../settings/settings.service';

/** Playback speeds offered by the player (mirrors the backend validation of `player.speed`). */
export const PLAYER_SPEEDS = [0.75, 1, 1.25, 1.5] as const;
export const DEFAULT_SPEED = 1;
const SPEED_KEY = 'player.speed';

/** Loads and saves the remembered playback speed. Both methods reject on failure; the caller shows the message. */
@Injectable({ providedIn: 'root' })
export class PlayerSpeedService {
  private readonly settings = inject(SettingsService);

  /** An unknown saved value means the default. */
  async load(): Promise<number> {
    const saved = Number((await this.settings.load())[SPEED_KEY]);
    return (PLAYER_SPEEDS as readonly number[]).includes(saved) ? saved : DEFAULT_SPEED;
  }

  async save(speed: number): Promise<void> {
    await this.settings.save({ [SPEED_KEY]: String(speed) });
  }
}
