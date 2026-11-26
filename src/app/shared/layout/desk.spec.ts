import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Desk } from './desk';
import { RecordPane } from './record-pane';
import { ShellLayer } from './shell-layer';
import { RECORD_KIT } from '../components/record';

@Component({
  imports: [Desk, RecordPane, ...RECORD_KIT],
  template: `<gz-desk [open]="open()" label="Application 1041" (closed)="open.set(false)">
    <h1>Applications</h1>
    <input class="filter" aria-label="Filter" />
    <gz-record-pane
      deskSlot
      heading="Marisol Etienne"
      noun="application"
      backLabel="Applications"
      position="1 of 20 on this page"
      [hasNext]="true"
      (closed)="open.set(false)"
    >
      <span paneMeta>Under review</span>
      <gz-record-section heading="Loan">
        <gz-record-group heading="Request" note="The application has no loan type.">
          <div gz-record-row label="Requested" [numeric]="true">$1,180,000</div>
          <div gz-record-row label="Loan type" [missing]="true" reason="The application has no loan type"></div>
        </gz-record-group>
      </gz-record-section>
    </gz-record-pane>
  </gz-desk>`,
})
class Host {
  open = signal(false);
  desk = viewChild.required(Desk);
}

function setup() {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
}
const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

describe('Desk: docked record pane', () => {
  it('opens the record beside the register with previous, next and close', () => {
    const { fixture, el, host } = setup();
    expect(el.querySelector('.desk-slot')).toBeNull();
    host.open.set(true);
    fixture.detectChanges();
    const slot = el.querySelector('aside.desk-slot')!;
    expect(slot.getAttribute('aria-label')).toBe('Application 1041');
    expect(text(slot.querySelector('h2'))).toBe('Marisol Etienne');
    expect(text(slot.querySelector('.pane-meta'))).toBe('Under review');
    const prev = slot.querySelector<HTMLButtonElement>('[aria-label="Previous application"]')!;
    const next = slot.querySelector<HTMLButtonElement>('[aria-label="Next application"]')!;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
  });

  it('reads the record as ruled rows, with a missing value on the hatch and its reason once', () => {
    const { fixture, el, host } = setup();
    host.open.set(true);
    fixture.detectChanges();
    const rows = [...el.querySelectorAll('.record-row')];
    expect(rows.map((r) => text(r.querySelector('dt')))).toEqual(['Requested', 'Loan type']);
    expect(text(rows[0].querySelector('dd'))).toBe('$1,180,000');
    expect(rows[1].querySelector('dd')!.classList).toContain('na');
    expect(text(rows[1].querySelector('.na-word'))).toBe('Unavailable');
    expect(text(el.querySelector('.record-note'))).toBe('The application has no loan type.');
  });

  it('closes on Escape', () => {
    const { fixture, el, host } = setup();
    host.open.set(true);
    fixture.detectChanges();
    el.querySelector('gz-desk')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(host.open()).toBe(false);
    expect(el.querySelector('.desk-slot')).toBeNull();
  });

  it('leaves Escape in a field to the field: the record stays open', () => {
    const { fixture, el, host } = setup();
    host.open.set(true);
    fixture.detectChanges();
    el.querySelector('input.filter')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(host.open()).toBe(true);
    expect(el.querySelector('.desk-slot')).not.toBeNull();
  });

  it('at laptop width becomes a sheet: the shell scrim closes it and the register behind is inert', () => {
    const { fixture, el, host } = setup();
    const layer = TestBed.inject(ShellLayer);
    host.desk().mode.set('sheet');
    host.open.set(true);
    fixture.detectChanges();
    TestBed.tick();
    expect(layer.sheetOpen()).toBe(true);
    expect(el.querySelector('.desk-main')!.hasAttribute('inert')).toBe(true);
    layer.dismissSheet();
    fixture.detectChanges();
    TestBed.tick();
    expect(host.open()).toBe(false);
    expect(layer.sheetOpen()).toBe(false);
  });
});
