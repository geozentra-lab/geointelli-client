import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Sheet } from './sheet';
import { ShellLayer } from './shell-layer';

@Component({
  imports: [Sheet],
  template: `<button type="button" class="opener" (click)="open.set(true)">Ask</button>
    <gz-sheet heading="Ask about this property" [open]="open()" (closed)="open.set(false)">
      <p class="content">Form</p>
    </gz-sheet>`,
})
class Host {
  open = signal(false);
}

describe('Sheet', () => {
  it('registers with the shell while open, so the scrim and Escape can close it', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const layer = TestBed.inject(ShellLayer);
    expect(el.querySelector('.sheet')).toBeNull();
    expect(layer.sheetOpen()).toBe(false);

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const sheet = el.querySelector('.sheet')!;
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(sheet.querySelector('h2')!.textContent).toContain('Ask about this property');
    expect(sheet.querySelector('.content')).toBeTruthy();
    expect(layer.sheetOpen()).toBe(true);

    // The shell's scrim click or Escape asks the open sheet to close.
    layer.dismissSheet();
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(el.querySelector('.sheet')).toBeNull();
    expect(layer.sheetOpen()).toBe(false);
  });

  it('closes from its own button', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.sheet-head button')!
      .click();
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
  });
});
