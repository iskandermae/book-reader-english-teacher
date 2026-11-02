import { TestBed } from '@angular/core/testing';
import { SettingsService } from '../settings/settings.service';
import { PlayerSpeedService } from './player-speed.service';

describe('PlayerSpeedService', () => {
  const settings = { load: vi.fn(), save: vi.fn() };
  const service = () => TestBed.inject(PlayerSpeedService);

  beforeEach(() => {
    settings.load.mockReset();
    settings.save.mockReset().mockResolvedValue({});
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: settings }] });
  });

  it('loads the saved speed', async () => {
    settings.load.mockResolvedValue({ 'player.speed': '1.25' });
    await expect(service().load()).resolves.toBe(1.25);
  });

  it.each(['', '2', 'abc'])('falls back to 1 for the unknown value "%s"', async (value) => {
    settings.load.mockResolvedValue({ 'player.speed': value });
    await expect(service().load()).resolves.toBe(1);
  });

  it('saves the speed as text under player.speed', async () => {
    await service().save(0.75);
    expect(settings.save).toHaveBeenCalledWith({ 'player.speed': '0.75' });
  });

  it('lets a failed load or save reject for the caller to show', async () => {
    settings.load.mockRejectedValue(new Error('down'));
    settings.save.mockRejectedValue(new Error('down'));
    await expect(service().load()).rejects.toThrow('down');
    await expect(service().save(1)).rejects.toThrow('down');
  });
});
