import {
  Component,
  ElementRef,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  contentChildren,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { Sort } from './sort';

/**
 * The shared table (DESIGN.md §7). Every list is a real <table>; this adds the register behaviour:
 *
 *   <table gz-table [(sort)]="sort" [(selected)]="id" (activated)="open($event)" [paneOpen]="!!id">
 *     <thead><tr>
 *       <th gz-sort="name">Applicant</th>
 *       <th gz-sort="amount" numeric>Requested</th>
 *       <th data-priority="3">Loan type</th>
 *     </tr></thead>
 *     <tbody>
 *       <tr [gz-row]="a.id">…<td class="num">…</td><td gz-cell [missing]="!a.type" data-priority="3">…</td></tr>
 *     </tbody>
 *   </table>
 *
 * - Header: sticky under the top bar (`sticky="page"`), at 0 in its own scroll area (`"local"`), or
 *   not at all (`"none"`). Sortable headers hold a button; the active one carries aria-sort and one
 *   copper arrow.
 * - Numbers: right-aligned and tabular (class "num" or the `numeric` header input).
 * - Columns: `data-priority` 1-3. Priority 3 hides while a record pane is open (`paneOpen`); on
 *   phones only priority 1 shows, with second lines (class "m-only cell-sub") under it.
 * - Rows: Up and Down move the selection, Enter or a click activates the row, Escape is reported
 *   (`dismissed`) so the page can close its pane. Interactive content inside a row works as usual.
 *
 * Its styles load with the first page that uses it, not with the shell.
 */
@Component({
  selector: 'table[gz-table]',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'gz-table',
    '[class.pane-open]': 'paneOpen()',
    '[attr.data-sticky]': 'sticky()',
    '(keydown)': 'onKey($event)',
  },
  styles: `
    .gz-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: var(--surface);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      font-variant-numeric: tabular-nums lining-nums;
    }
    .gz-table thead th {
      position: sticky;
      top: var(--topbar-h);
      z-index: var(--z-sticky-head);
      padding: 8px 10px;
      background: var(--thead);
      color: var(--ink-2);
      font-weight: 500;
      text-align: left;
      vertical-align: bottom;
      white-space: nowrap;
      border-bottom: 1px solid var(--rule-strong);
    }
    .gz-table[data-sticky='local'] thead th {
      top: 0;
    }
    .gz-table[data-sticky='none'] thead th {
      position: static;
    }
    .gz-table th.num,
    .gz-table td.num {
      text-align: right;
    }
    .gz-table th button {
      all: unset;
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
      cursor: pointer;
    }
    .gz-table th button:hover {
      color: var(--ink);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .gz-table th button:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .gz-table th[aria-sort] button {
      color: var(--ink);
    }
    .gz-table .sort-arrow {
      color: var(--copper);
    }
    .gz-table td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--rule);
      vertical-align: top;
    }
    .gz-table tbody tr:last-child > td {
      border-bottom: 1px solid var(--rule);
    }
    .gz-table tbody tr:hover > td {
      background-color: var(--row-hover);
    }
    .gz-table tbody tr.sel > td {
      background-color: var(--copper-tint);
    }
    .gz-table tbody tr.sel > td:first-child {
      box-shadow: inset 3px 0 0 var(--copper);
    }
    .gz-table tr.gz-row {
      cursor: pointer;
    }
    .gz-table tr.gz-row:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: -2px;
    }
    .gz-table td.na {
      background-image: var(--hatch);
    }
    .gz-table .cell-main {
      font-weight: 500;
    }
    .gz-table .cell-sub {
      display: block;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
      font-weight: 400;
    }
    .gz-table .m-only {
      display: none;
    }
    .gz-table .nowrap {
      white-space: nowrap;
    }
    .gz-table.pane-open [data-priority='3'] {
      display: none;
    }
    .gz-table tr.empty-row:hover > td {
      background: var(--surface);
    }
    .gz-table .table-empty {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sp-12);
      padding: var(--sp-16) 0;
      font-size: var(--fs-body);
      white-space: normal;
    }
    .gz-table .table-empty p {
      margin: 0;
      max-width: var(--measure);
    }
    .table-note {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
      max-width: 90ch;
    }
    @media (max-width: 700px) {
      .gz-table [data-priority='2'],
      .gz-table [data-priority='3'] {
        display: none;
      }
      .gz-table .m-only {
        display: block;
      }
      .gz-table td {
        white-space: normal;
      }
    }
  `,
})
export class GzTable {
  readonly sort = model<Sort | null>(null);
  readonly selected = model<unknown>(null);
  readonly sticky = input<'page' | 'local' | 'none'>('page');
  /** A record pane is open beside the table: priority-3 columns hide. */
  readonly paneOpen = input(false);
  /** Enter or a click on a row: open its record. */
  readonly activated = output<unknown>();
  /** Escape inside the table: close the record. */
  readonly dismissed = output<void>();
  readonly rows = contentChildren(Row, { descendants: true });
  /** The one row in the tab order: the selected row, or the first. */
  readonly tabKey = computed(() => {
    const keys = this.rows().map((r) => r.key());
    const selected = this.selected();
    return keys.includes(selected) ? selected : keys[0];
  });

  /** Picks a column, or flips it when it is already the sorted one. */
  sortBy(key: string, first: 'asc' | 'desc') {
    const s = this.sort();
    this.sort.set(
      s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: first },
    );
  }
  select(key: unknown, activate = false) {
    this.selected.set(key);
    if (activate) this.activated.emit(key);
  }
  protected onKey(event: KeyboardEvent) {
    const rows = this.rows();
    const index = rows.findIndex((r) => r.element === event.target);
    if (index < 0) {
      if (event.key === 'Escape') this.dismissed.emit();
      return;
    }
    let next = -1;
    if (event.key === 'ArrowDown') next = Math.min(rows.length - 1, index + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = rows.length - 1;
    else if (event.key === 'Enter') {
      event.preventDefault();
      this.select(rows[index].key(), true);
      return;
    } else if (event.key === 'Escape') {
      this.dismissed.emit();
      return;
    } else return;
    event.preventDefault();
    this.select(rows[next].key());
    rows[next].element.focus();
  }
}

/** A selectable row: `<tr [gz-row]="record.id">`. */
@Component({
  selector: 'tr[gz-row]',
  template: '<ng-content />',
  host: {
    // A class, not the attribute: [gz-row]="id" is a binding and leaves no attribute in the DOM,
    // so a tr[gz-row] rule never matched (rows had no pointer cursor and no focus ring).
    class: 'gz-row',
    '[class.sel]': 'isSelected()',
    '[attr.aria-current]': "isSelected() ? 'true' : null",
    '[attr.tabindex]': 'table.tabKey() === key() ? 0 : -1',
    '(click)': 'onClick($event)',
  },
})
export class Row {
  /** Not `required`: sibling rows read each other's keys while the list is still binding. */
  readonly key = input<unknown>(undefined, { alias: 'gz-row' });
  protected readonly table = inject(GzTable);
  readonly element: HTMLElement = inject(ElementRef).nativeElement;
  readonly isSelected = computed(() => this.table.selected() === this.key());
  protected onClick(event: MouseEvent) {
    // Links, buttons and fields inside the row do their own thing.
    const hit = (event.target as HTMLElement).closest('a, button, input, select, textarea, label');
    if (hit && this.element.contains(hit)) return;
    this.table.select(this.key(), true);
  }
}

/**
 * A sortable column header: `<th gz-sort="price" numeric>Price</th>`. Numbers and dates start
 * high-to-low when picked; text starts A to Z.
 */
@Component({
  selector: 'th[gz-sort]',
  template: `<button type="button" (click)="toggle()">
    <ng-content /><span class="sort-arrow" aria-hidden="true">{{ arrow() }}</span>
  </button>`,
  host: {
    scope: 'col',
    '[class.num]': 'numeric()',
    '[attr.aria-sort]': 'ariaSort()',
  },
})
export class SortHeader {
  readonly key = input.required<string>({ alias: 'gz-sort' });
  readonly numeric = input(false, { transform: booleanAttribute });
  readonly first = input<'asc' | 'desc' | null>(null);
  private readonly table = inject(GzTable);
  private readonly dir = computed(() =>
    this.table.sort()?.key === this.key() ? this.table.sort()!.dir : null,
  );
  readonly ariaSort = computed(() => {
    const d = this.dir();
    return d === 'asc' ? 'ascending' : d === 'desc' ? 'descending' : null;
  });
  readonly arrow = computed(() => (this.dir() === 'asc' ? '↑' : this.dir() === 'desc' ? '↓' : ''));
  toggle() {
    this.table.sortBy(this.key(), this.first() ?? (this.numeric() ? 'desc' : 'asc'));
  }
}

/**
 * The body of an empty table: one sentence where the rows would be, plus the action that creates
 * the first one, or "Clear filter" when a filter emptied it (DESIGN.md §7).
 */
@Component({
  selector: 'tr[gz-empty-row]',
  template: `<td [attr.colspan]="colspan()">
    <div class="table-empty" role="status">
      <p>{{ message() }}</p>
      <ng-content />
    </div>
  </td>`,
  host: { class: 'empty-row' },
})
export class EmptyRow {
  readonly message = input.required<string>();
  readonly colspan = input(1);
}
