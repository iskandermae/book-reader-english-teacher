import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TextSelection } from './capture-selection';
import { SelectionToolbarComponent } from './selection-toolbar.component';

const captured: TextSelection = { text: 'hello', context: 'hello world' };

@Component({
  imports: [SelectionToolbarComponent],
  template: `<app-selection-toolbar [selection]="selection" [anchor]="anchor" (translate)="emitted.push($event)" />`,
})
class HostComponent {
  selection = captured;
  anchor = new DOMRect(10, 100, 50, 20);
  emitted: TextSelection[] = [];
}

describe('SelectionToolbarComponent', () => {
  it('emits the captured selection when Translate is clicked', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const translate = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLElement).textContent!.trim() === 'Translate',
    ) as HTMLButtonElement;
    translate.click();
    expect(fixture.componentInstance.emitted).toEqual([captured]);
  });
});
