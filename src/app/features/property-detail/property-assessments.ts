import { Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Assessment } from '../../core/models/assessment';
import { amount } from '../../core/models/property-valuation';
import { RECORD_KIT } from '../../shared/components/record';
import { Sort, TABLE_KIT, sortRows } from '../../shared/table';
import { NOT_IN_RECORD } from './property-facts';

/**
 * The county's assessments as a sortable table (DESIGN.md §7), newest roll year first. Missing
 * figures are the Unavailable marker; an assessment is not a market value, and the note says so.
 * Used on the Sales tab and in the live-map dialog.
 */
@Component({
  selector: 'gz-property-assessments',
  imports: [CurrencyPipe, ...RECORD_KIT, ...TABLE_KIT],
  template: `
    <gz-record-section heading="Assessments">
      <p class="pa-meta">Values set by the county for tax purposes; not a market value.</p>
      @if (rows().length) {
        <table gz-table sticky="none" [(sort)]="sort">
          <caption class="sr-only">
            Assessments by roll year
          </caption>
          <thead>
            <tr>
              <th gz-sort="year" first="desc">Year</th>
              <th gz-sort="totalValue" numeric>Total value</th>
              <th gz-sort="assessedValue" numeric>Assessed</th>
              <th gz-sort="landValue" numeric data-priority="2">Land</th>
              <th gz-sort="buildingOnlyValue" numeric data-priority="2">Building</th>
            </tr>
          </thead>
          <tbody>
            @for (a of rows(); track $index) {
              <tr>
                <td gz-cell class="num" [missing]="a.year === null" [reason]="reason">{{ a.year }}</td>
                <td gz-cell class="num nowrap" [missing]="a.totalValue === null" [reason]="reason">
                  {{ a.totalValue | currency: 'USD' : 'symbol' : '1.0-0' }}
                </td>
                <td gz-cell class="num nowrap" [missing]="a.assessedValue === null" [reason]="reason">
                  {{ a.assessedValue | currency: 'USD' : 'symbol' : '1.0-0' }}
                </td>
                <td gz-cell class="num nowrap" data-priority="2" [missing]="a.landValue === null" [reason]="reason">
                  {{ a.landValue | currency: 'USD' : 'symbol' : '1.0-0' }}
                </td>
                <td
                  gz-cell
                  class="num nowrap"
                  data-priority="2"
                  [missing]="a.buildingOnlyValue === null"
                  [reason]="reason"
                >
                  {{ a.buildingOnlyValue | currency: 'USD' : 'symbol' : '1.0-0' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (anyMissing()) {
          <p class="table-note">Unavailable: not in the county record.</p>
        }
      } @else {
        <p class="pa-empty">No assessments are on record for this property.</p>
      }
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .pa-meta {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
    }
    .pa-empty {
      margin: 0;
      font-size: var(--fs-body);
      color: var(--ink-2);
    }
  `,
})
export class PropertyAssessments {
  readonly assessments = input<readonly Assessment[] | null | undefined>([]);
  readonly reason = NOT_IN_RECORD;
  readonly sort = signal<Sort | null>({ key: 'year', dir: 'desc' });
  private readonly cleaned = computed(() =>
    (this.assessments() ?? []).map((a) => ({
      year: amount(a.year),
      totalValue: amount(a.totalValue),
      assessedValue: amount(a.assessedValue),
      landValue: amount(a.landValue),
      buildingOnlyValue: amount(a.buildingOnlyValue),
    })),
  );
  readonly rows = computed(() =>
    sortRows(this.cleaned(), this.sort(), (a, key) => a[key as keyof typeof a]),
  );
  readonly anyMissing = computed(() =>
    this.cleaned().some((a) => Object.values(a).some((v) => v === null)),
  );
}
