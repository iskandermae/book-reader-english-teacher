import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HealthService } from './health.service';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  async function render(isOk: () => Promise<boolean>): Promise<string> {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), { provide: HealthService, useValue: { isOk } }],
    });
    const fixture = TestBed.createComponent(HomeComponent);
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).querySelector('p')!.textContent!;
  }

  it('shows "API OK" when the health check succeeds', async () => {
    expect(await render(() => Promise.resolve(true))).toContain('API OK');
  });

  it('shows an error when the health check fails', async () => {
    expect(await render(() => Promise.reject(new Error('down')))).toContain('API error');
  });
});
