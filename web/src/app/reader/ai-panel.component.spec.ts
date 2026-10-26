import { TestBed } from '@angular/core/testing';
import { AiPanelComponent } from './ai-panel.component';

describe('AiPanelComponent', () => {
  function create(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(AiPanelComponent);
    fixture.componentRef.setInput('title', 'Translation');
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the title and the streamed text', () => {
    const { fixture, el } = create({ text: 'Пер' });
    fixture.componentRef.setInput('text', 'Перший');
    fixture.detectChanges();
    expect(el.querySelector('h2')!.textContent).toBe('Translation');
    expect(el.querySelector('.text')!.textContent).toBe('Перший');
  });

  it('shows an error', () => {
    const { el } = create({ error: 'Ollama is not running.' });
    expect(el.querySelector('[role=alert]')!.textContent).toBe('Ollama is not running.');
  });

  it('shows a waiting hint only until the first text arrives', () => {
    const { fixture, el } = create({ loading: true });
    expect(el.textContent).toContain('Working');
    fixture.componentRef.setInput('text', 'x');
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Working');
  });

  it('emits closed when Close is clicked', () => {
    const { fixture, el } = create({});
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    el.querySelector('button')!.click();
    expect(closed).toBe(1);
  });
});
