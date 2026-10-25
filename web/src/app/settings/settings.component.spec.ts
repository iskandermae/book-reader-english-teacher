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
});
