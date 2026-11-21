import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LlmCallEntry, LlmLogService } from './llm-log.service';
import { reportError } from '../report-error';

@Component({
  selector: 'app-llm-log',
  imports: [DatePipe, RouterLink],
  styles: `
    pre { max-height: 20rem; overflow: auto; white-space: pre-wrap; }
  `,
  template: `
    <h1>LLM log</h1>
    <a routerLink="/">Library</a>
    <button type="button" (click)="refresh()">Refresh</button>
    <button type="button" (click)="clear()" [disabled]="entries().length === 0">Clear</button>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <p>Loading...</p>
    } @else if (entries().length === 0) {
      <p>No LLM calls yet. The last 10 calls appear here.</p>
    } @else {
      @for (entry of entries(); track $index) {
        <details>
          <summary>
            {{ entry.time | date: 'mediumTime' }} - {{ entry.action }} - {{ entry.model }} - {{ entry.durationMs }} ms
            @if (entry.error) {
              <strong> - failed</strong>
            }
          </summary>
          @if (entry.error) {
            <p role="alert">{{ entry.error }}</p>
          }
          <h2>Prompt</h2>
          <pre>{{ entry.prompt }}</pre>
          <h2>Answer</h2>
          <pre>{{ entry.answer }}</pre>
        </details>
      }
    }
  `,
})
export class LlmLogComponent implements OnInit {
  private readonly log = inject(LlmLogService);
  protected readonly entries = signal<LlmCallEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  ngOnInit(): Promise<void> {
    return this.refresh();
  }

  protected async refresh(): Promise<void> {
    try {
      this.entries.set(await this.log.list());
      this.error.set('');
    } catch (e) {
      this.error.set(reportError('Could not load the LLM log.', e));
    } finally {
      this.loading.set(false);
    }
  }

  protected async clear(): Promise<void> {
    try {
      await this.log.clear();
      this.entries.set([]);
      this.error.set('');
    } catch (e) {
      this.error.set(reportError('Could not clear the LLM log.', e));
    }
  }
}
