import { TestBed } from '@angular/core/testing';
import { SettingsService } from '../settings/settings.service';
import { AppearanceService } from './appearance.service';

describe('AppearanceService', () => {
  // Failures are logged on purpose; keep the test output clean and let tests assert on it.
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => consoleError.mockRestore());

  const settings = { load: vi.fn(), save: vi.fn() };

  beforeEach(() => {
    settings.load.mockReset().mockResolvedValue({});
    settings.save.mockReset().mockResolvedValue({});
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: settings }] });
  });

  afterEach(() => document.documentElement.classList.remove('dark'));

  const create = () => TestBed.inject(AppearanceService);
  const isDark = () => document.documentElement.classList.contains('dark');

  it('uses defaults when nothing is saved', async () => {
    const service = create();
    await service.load();
    TestBed.tick();
    expect(service.values()).toEqual({ 'reader.fontSize': 'medium', 'reader.theme': 'light', 'reader.width': 'medium' });
    expect(isDark()).toBe(false);
  });

  it('applies saved values and the dark class on the root', async () => {
    settings.load.mockResolvedValue({ 'reader.fontSize': 'xlarge', 'reader.theme': 'dark', 'reader.width': 'narrow' });
    const service = create();
    await service.load();
    TestBed.tick();
    expect(service.values()).toEqual({ 'reader.fontSize': 'xlarge', 'reader.theme': 'dark', 'reader.width': 'narrow' });
    expect(isDark()).toBe(true);
  });

  it('falls back to defaults when a value is unknown or loading fails', async () => {
    settings.load.mockResolvedValue({ 'reader.fontSize': 'huge', 'reader.theme': 'dark' });
    const service = create();
    await service.load();
    expect(service.values()['reader.fontSize']).toBe('medium');
    expect(service.values()['reader.theme']).toBe('dark');

    settings.load.mockRejectedValue(new Error('down'));
    await expect(service.load()).resolves.toBeUndefined();
    expect(service.values()['reader.theme']).toBe('dark');
  });

  it.each([
    ['reader.fontSize', 'large'],
    ['reader.theme', 'dark'],
    ['reader.width', 'wide'],
  ] as const)('set %s applies at once and sends a PUT with only that key', async (key, value) => {
    const service = create();
    const done = service.set(key, value);
    expect(service.values()[key]).toBe(value);
    await done;
    expect(settings.save).toHaveBeenCalledWith({ [key]: value });
    expect(service.saveError()).toBe('');
  });

  it('keeps the new value and reports a message when saving fails', async () => {
    settings.save.mockRejectedValue(new Error('boom'));
    const service = create();
    await service.set('reader.theme', 'dark');
    expect(service.values()['reader.theme']).toBe('dark');
    expect(service.saveError()).toContain('boom');
    expect(consoleError).toHaveBeenCalled();
  });

  it('shows a message and keeps the defaults when loading fails', async () => {
    settings.load.mockRejectedValue({ detail: 'Settings file is corrupt.' }); // the shape the generated client throws
    const service = create();
    await service.load();
    expect(service.values()['reader.theme']).toBe('light');
    expect(service.saveError()).toContain('Settings file is corrupt.');
    expect(consoleError).toHaveBeenCalled();
  });

  describe('panelWidth', () => {
    it('loads a valid saved value', async () => {
      settings.load.mockResolvedValue({ 'reader.panelWidth': '55' });
      const service = create();
      await service.load();
      expect(service.panelWidth()).toBe(55);
    });

    it.each(['5', '71', '40.5', 'abc', ''])('ignores the invalid saved value "%s"', async (value) => {
      settings.load.mockResolvedValue({ 'reader.panelWidth': value });
      const service = create();
      await service.load();
      expect(service.panelWidth()).toBe(40);
    });

    it('clamps the width, applies it at once and saves it', async () => {
      const service = create();
      const done = service.setPanelWidth(90);
      expect(service.panelWidth()).toBe(70);
      await done;
      expect(settings.save).toHaveBeenCalledWith({ 'reader.panelWidth': '70' });
    });
  });
});
