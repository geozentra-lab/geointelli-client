import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { CONFIDENCE } from '../../shared/components/value-forecast';
import { ValuationHistoryEntry, amount } from '../../core/models/property-valuation';
import { RECORD_KIT } from '../../shared/components/record';
import { TABLE_KIT } from '../../shared/table';
import { formatRecordDate } from '../../shared/data/format';
import { PropertyInsightsActions as A } from '../../store/property-insights/property-insights.actions';
import { selectPropertyInsights } from '../../store/property-insights/property-insights.selectors';

/**
 * Archived ZentraValue versions of the property (GET /properties/id/{id}/valuations), newest
 * first. Each keeps the dates and inputs of its own model run; nothing current is put in their
 * place, and reading the history never starts a revaluation.
 */
@Component({
  selector: 'gz-valuation-history',
  imports: [CurrencyPipe, RequestStatus, Pagination, ...RECORD_KIT, ...TABLE_KIT],
  template: `
    <gz-record-section heading="Valuation history">
      <p class="vh-lede">Every published version, with the inputs its model run used.</p>
      <gz-request-status
        [loading]="history().loading && !history().value"
        loadingText="Loading valuation history…"
        [error]="history().error"
        retryLabel="Retry history"
        (retry)="load(page())"
      />
      @if (history().value; as h) {
        @if (h.content.length) {
          <div [attr.aria-busy]="history().loading">
            <table gz-table sticky="none">
              <caption class="sr-only">
                Published valuations, newest first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Valued on</th>
                  <th scope="col" class="num">Estimate</th>
                  <th scope="col" class="num" data-priority="2">80% range</th>
                  <th scope="col" data-priority="3">Inputs</th>
                  <th scope="col" data-priority="3">Source</th>
                </tr>
              </thead>
              <tbody>
                @for (e of h.content; track e.id) {
                  @let v = e.valuation;
                  @let valued = day(v.method?.predictionDate);
                  @let through = day(v.method?.dataThrough);
                  <tr>
                    <td gz-cell class="nowrap" [missing]="!valued" reason="Not recorded for this version">
                      {{ valued }}
                      @if (through) {
                        <span class="cell-sub">Sales through {{ through }}</span>
                      }
                    </td>
                    @if (shows(e)) {
                      <td gz-cell class="num nowrap" [missing]="estimate(e) === null" reason="Not recorded for this version">
                        {{ estimate(e) | currency: 'USD' : 'symbol' : '1.0-0' }}
                        <span class="cell-sub">{{ confidence(e) }}</span>
                      </td>
                      <td gz-cell class="num nowrap" data-priority="2" [missing]="!range(e)" reason="Not recorded for this version">
                        @if (range(e); as r) {
                          {{ r.low | currency: 'USD' : 'symbol' : '1.0-0' }} to
                          {{ r.high | currency: 'USD' : 'symbol' : '1.0-0' }}
                        }
                      </td>
                    } @else {
                      <td class="num" colspan="2">
                        <span class="cell-sub">No estimate in this version</span>
                      </td>
                    }
                    <td data-priority="3" class="wrap">
                      @if (e.modelEvidence?.status === 'RECORDED') {
                        @if (amount(e.modelEvidence?.lastSale?.price); as price) {
                          <span class="cell-line"
                            >Last sale {{ price | currency: 'USD' : 'symbol' : '1.0-0' }}{{
                              day(e.modelEvidence?.lastSale?.date) ? ', ' + day(e.modelEvidence?.lastSale?.date) : ''
                            }}</span
                          >
                        }
                        @if (e.modelEvidence?.nearbySales; as n) {
                          @if (n.count) {
                            <span class="cell-line"
                              >{{ n.count }} nearby sales, median
                              {{ n.medianPrice | currency: 'USD' : 'symbol' : '1.0-0' }}</span
                            >
                          }
                        }
                      } @else {
                        <span class="cell-sub">Inputs were not recorded</span>
                      }
                    </td>
                    <td data-priority="3" [class.attention]="e.provenance === 'SEEDED_CURRENT'">
                      {{ e.provenanceLabel || e.provenance }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <gz-pagination
            [page]="h.page"
            [pages]="h.totalPages"
            [total]="h.totalElements"
            [loading]="history().loading"
            (changed)="load($event)"
          />
          <p class="table-note">
            Inputs are the frozen last sale and nearby sales each model run saw, not today's
            comparables. Versions labelled "recorded before history" were stored before versions
            were archived.
          </p>
        } @else {
          <p class="vh-empty">No earlier valuation of this property has been archived yet.</p>
        }
      }
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .vh-lede {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
    }
    .vh-empty {
      margin: 0;
      font-size: var(--fs-body);
      color: var(--ink-2);
    }
    td.wrap {
      white-space: normal;
    }
    .cell-line {
      display: block;
      white-space: nowrap;
    }
  `,
})
export class ValuationHistory {
  private store = inject(Store);
  propertyId = input.required<number>();
  private insights = this.store.selectSignal(selectPropertyInsights);
  history = computed(() =>
    this.insights().propertyId === this.propertyId()
      ? this.insights().history
      : { value: null, loading: true, error: null },
  );
  page = computed(() => this.history().value?.page ?? 0);
  constructor() {
    effect(() => {
      this.propertyId();
      untracked(() => this.load(0));
    });
  }
  load(page: number) {
    this.store.dispatch(A.loadHistory({ propertyId: this.propertyId(), page }));
  }
  shows(e: ValuationHistoryEntry) {
    return e.valuation.status === 'supported' || e.valuation.status === 'limited';
  }
  estimate(e: ValuationHistoryEntry) {
    return amount(e.valuation.estimate?.value);
  }
  range(e: ValuationHistoryEntry) {
    const low = amount(e.valuation.estimate?.range80?.low),
      high = amount(e.valuation.estimate?.range80?.high);
    return low !== null && high !== null ? { low, high } : null;
  }
  readonly amount = amount;
  day(value: string | null | undefined) {
    return formatRecordDate(value);
  }
  confidence(e: ValuationHistoryEntry) {
    const c = (e.valuation.estimate?.confidence ?? '').toLowerCase();
    return CONFIDENCE[c]?.label ?? 'Confidence not stated';
  }
}
