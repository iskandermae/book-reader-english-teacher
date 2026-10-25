import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HealthService } from './health.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <h1>Book Reader English Teacher</h1>
    <p>{{ status() }}</p>
    <a routerLink="/settings">Settings</a>
  `,
})
export class HomeComponent implements OnInit {
  private readonly health = inject(HealthService);
  protected readonly status = signal('Checking API...');

  async ngOnInit(): Promise<void> {
    try {
      this.status.set((await this.health.isOk()) ? 'API OK' : 'API error');
    } catch {
      this.status.set('API error');
    }
  }
}
