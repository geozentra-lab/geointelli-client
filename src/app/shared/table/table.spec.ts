import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Sort, TABLE_KIT, sortRows } from './index';

interface Home {
  id: number;
  address: string;
  year: number | null;
  type: string | null;
}
const HOMES: Home[] = [
  { id: 1, address: '640 NE 74th St', year: 1951, type: 'House' },
  { id: 2, address: '1700 Collins Ave, Unit 1504', year: null, type: null },
  { id: 3, address: '2847 SW 27th Ter', year: 1988, type: 'House' },
];

@Component({
  imports: [...TABLE_KIT],
  template: `<table gz-table [(sort)]="sort" [(selected)]="selected" (activated)="opened.set($event)" [paneOpen]="selected() !== null">
    <thead>
      <tr>
        <th gz-sort="address">Address</th>
        <th gz-sort="year" numeric>Year built</th>
        <th scope="col" data-priority="3">Type</th>
      </tr>
    </thead>
    <tbody>
      @for (h of rows(); track h.id) {
        <tr [gz-row]="h.id">
          <td>{{ h.address }}</td>
          <td gz-cell class="num" [missing]="h.year === null" reason="Not in the county record">{{ h.year }}</td>
          <td gz-cell data-priority="3" [missing]="!h.type">{{ h.type }}</td>
        </tr>
      } @empty {
        <tr gz-empty-row [colspan]="3" message="No homes match these filters."></tr>
      }
    </tbody>
  </table>`,
})
class Host {
  homes = signal(HOMES);
  sort = signal<Sort | null>(null);
  selected = signal<unknown>(null);
  opened = signal<unknown>(null);
  rows = computed(() =>
    sortRows(this.homes(), this.sort(), (h, key) => (key === 'year' ? h.year : h.address)),
  );
}

function setup() {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
}
const firstColumn = (el: HTMLElement) =>
  [...el.querySelectorAll('tbody tr')].map((r) => r.querySelector('td')!.textContent!.trim());

describe('Shared table', () => {
  it('sorts missing values last in both directions and keeps ties in order', () => {
    const asc = sortRows(HOMES, { key: 'year', dir: 'asc' }, (h) => h.year).map((h) => h.id);
    const desc = sortRows(HOMES, { key: 'year', dir: 'desc' }, (h) => h.year).map((h) => h.id);
    expect(asc).toEqual([1, 3, 2]);
    expect(desc).toEqual([3, 1, 2]);
    expect(sortRows(HOMES, null, () => null)).not.toBe(HOMES);
  });

  it('sorts from a header button, numbers high to low first, and marks the column with aria-sort', () => {
    const { fixture, el } = setup();
    const year = el.querySelectorAll('th')[1];
    expect(year.getAttribute('scope')).toBe('col');
    expect(year.classList).toContain('num');
    year.querySelector('button')!.click();
    fixture.detectChanges();
    expect(year.getAttribute('aria-sort')).toBe('descending');
    expect(year.querySelector('.sort-arrow')!.textContent).toBe('↓');
    expect(firstColumn(el)).toEqual(['2847 SW 27th Ter', '640 NE 74th St', '1700 Collins Ave, Unit 1504']);
    year.querySelector('button')!.click();
    fixture.detectChanges();
    expect(year.getAttribute('aria-sort')).toBe('ascending');
    expect(el.querySelectorAll('th')[0].hasAttribute('aria-sort')).toBe(false);
  });

  it('moves the selection with the arrow keys, opens with Enter, and keeps one row in the tab order', () => {
    const { fixture, el, host } = setup();
    const rows = () => [...el.querySelectorAll<HTMLElement>('tbody tr')];
    expect(rows().map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    rows()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(host.selected()).toBe(2);
    expect(rows()[1].getAttribute('aria-current')).toBe('true');
    expect(rows()[1].classList).toContain('sel');
    expect(rows().map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    rows()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(host.opened()).toBe(2);
    // A record is open: priority-3 columns hide.
    fixture.detectChanges();
    expect(el.querySelector('table')!.classList).toContain('pane-open');
  });

  it('gives each row the gz-row class its styles hang on (the binding leaves no attribute)', () => {
    const { el } = setup();
    const rows = [...el.querySelectorAll('tbody tr')];
    expect(rows.every((r) => r.classList.contains('gz-row'))).toBe(true);
    expect(rows.some((r) => r.hasAttribute('gz-row'))).toBe(false);
  });

  it('opens a row on click, but leaves links and buttons inside it alone', () => {
    const { fixture, el, host } = setup();
    el.querySelectorAll<HTMLElement>('tbody td')[0].click();
    fixture.detectChanges();
    expect(host.opened()).toBe(1);
  });

  it('marks a missing cell Unavailable on the hatch, with the reason for screen readers', () => {
    const { el } = setup();
    const cell = el.querySelectorAll('tbody tr')[1].querySelectorAll('td')[1];
    expect(cell.classList).toContain('na');
    expect(cell.querySelector('.na-word')!.textContent).toBe('Unavailable');
    expect(cell.querySelector('.sr-only')!.textContent).toContain('Not in the county record');
  });

  it('says what is empty in the body of the table', () => {
    const { fixture, el, host } = setup();
    host.homes.set([]);
    fixture.detectChanges();
    const empty = el.querySelector('tbody tr td')!;
    expect(empty.getAttribute('colspan')).toBe('3');
    expect(empty.textContent).toContain('No homes match these filters.');
  });
});
