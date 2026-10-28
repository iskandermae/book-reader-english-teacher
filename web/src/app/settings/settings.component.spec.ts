import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { SettingsService } from './settings.service';

describe('SettingsComponent', () => {
  async function render(service: Partial<SettingsService>) {
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [provideRouter([]), { provide: SettingsService, useValue: service }],
    });
    const fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();
    // Render what the async load produced.
    fixture.detectChanges();
    return fixture;
  }

  async function edit(fixture: ComponentFixture<SettingsComponent>, value: string) {
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('input[name="ui.sample"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('loads settings, saves edits and shows success', async () => {
    const save = vi.fn().mockResolvedValue({ 'ollama.model': '', 'ui.sample': 'hello' });
    const fixture = await render({
      load: () => Promise.resolve({ 'ollama.model': '', 'ui.sample': 'old' }),
      save,
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector<HTMLInputElement>('input[name="ui.sample"]')!.value).toBe('old');

    await edit(fixture, 'hello');

    expect(save).toHaveBeenCalledWith({ 'ollama.model': '', 'ui.sample': 'hello' });
    expect(el.querySelector('[role=status]')!.textContent).toContain('Settings saved');
  });

  it('shows the API error detail when saving fails', async () => {
    const fixture = await render({
      load: () => Promise.resolve({ 'ui.sample': '' }),
      save: () => Promise.reject(new Error('Value too long.')),
    });
    await edit(fixture, 'x');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=alert]')!.textContent).toContain('Value too long.');
  });

  it('shows a message and disables Save when loading fails', async () => {
    const fixture = await render({ load: () => Promise.reject(new Error('boom')) });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role=alert]')!.textContent).toContain('Could not load settings');
    expect(el.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
  });

  describe('Prompts tab', () => {
    const loaded = { 'ui.sample': 's', 'prompt.translate': 'T {selection}', 'prompt.explain': 'E {selection}' };

    async function openPrompts(service: Partial<SettingsService>) {
      const fixture = await render(service);
      const el = fixture.nativeElement as HTMLElement;
      el.querySelectorAll<HTMLButtonElement>('[role=tab]')[1].click();
      fixture.detectChanges();
      await fixture.whenStable();
      return { fixture, el };
    }

    it('keeps the prompts out of General and shows them with the placeholders in Prompts', async () => {
      const { fixture, el } = await openPrompts({ load: () => Promise.resolve(loaded) });
      expect(el.querySelector('textarea[name="prompt.translate"]')).toBeTruthy();
      expect(el.querySelector<HTMLTextAreaElement>('textarea[name="prompt.explain"]')!.value).toBe('E {selection}');
      expect(el.textContent).toContain('{paragraph}');
      expect(el.querySelector('input[name="ui.sample"]')).toBeNull();

      el.querySelectorAll<HTMLButtonElement>('[role=tab]')[0].click();
      fixture.detectChanges();
      expect(el.querySelector('textarea')).toBeNull();
      expect(el.querySelector('input[name="prompt.translate"]')).toBeNull();
      expect(el.querySelector('input[name="ui.sample"]')).toBeTruthy();
    });

    it('saves an edited prompt together with the other settings', async () => {
      const save = vi.fn().mockResolvedValue(loaded);
      const { fixture, el } = await openPrompts({ load: () => Promise.resolve(loaded), save });
      const area = el.querySelector<HTMLTextAreaElement>('textarea[name="prompt.translate"]')!;
      area.value = 'Translate {selection} now';
      area.dispatchEvent(new Event('input'));
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(save).toHaveBeenCalledWith({ ...loaded, 'prompt.translate': 'Translate {selection} now' });
    });

    it('Reset to default puts the default text into the textarea and saves it with Save', async () => {
      const save = vi.fn().mockResolvedValue(loaded);
      const loadDefaults = vi.fn().mockResolvedValue({ 'prompt.translate': 'DEFAULT {selection}', 'prompt.explain': 'X {selection}' });
      const { fixture, el } = await openPrompts({ load: () => Promise.resolve(loaded), save, loadDefaults });
      el.querySelectorAll<HTMLButtonElement>('button:not([role=tab]):not([type=submit])')[0].click();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(el.querySelector<HTMLTextAreaElement>('textarea[name="prompt.translate"]')!.value).toBe('DEFAULT {selection}');
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      expect(save).toHaveBeenCalledWith({ ...loaded, 'prompt.translate': 'DEFAULT {selection}' });
    });

    it('shows a message and keeps the text when the defaults cannot be loaded', async () => {
      const { fixture, el } = await openPrompts({
        load: () => Promise.resolve(loaded),
        loadDefaults: () => Promise.reject(new Error('down')),
      });
      el.querySelectorAll<HTMLButtonElement>('button:not([role=tab]):not([type=submit])')[0].click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('[role=alert]')!.textContent).toContain('Could not load the default');
      expect(el.querySelector<HTMLTextAreaElement>('textarea[name="prompt.translate"]')!.value).toBe('T {selection}');
    });

    it('shows the server message for a bad template', async () => {
      const { fixture, el } = await openPrompts({
        load: () => Promise.resolve(loaded),
        save: () => Promise.reject(new Error("Setting 'prompt.translate': unknown placeholder {x}.")),
      });
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('[role=alert]')!.textContent).toContain('unknown placeholder {x}');
    });
  });
});
