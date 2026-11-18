import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { CONFIDENCE } from '../../shared/components/value-forecast';
import { ValuationHistoryEntry, amount } from '../../core/models/property-valuation';
import { PropertyInsightsActions as A } from '../../store/property-insights/property-insights.actions';
import { selectPropertyInsights } from '../../store/property-insights/property-insights.selectors';

/**
 * Archived ZentraValue versions of the property (GET /properties/id/{id}/valuations), newest
 * first. Each keeps the dates and inputs of its own model run; nothing current is put in their
 * place, and reading the history never starts a revaluation.
 */
@Component({
  selector: 'gz-valuation-history',
  imports: [CurrencyPipe, DatePipe, RequestStatus, Pagination],
  template: `
    <div class="panel section">
      <div class="panelhead">
        <div>
          <h3>Valuation history</h3>
          <p class="smalltext muted">Every published version, with the inputs its model run used</p>
        </div>
      </div>
      <gz-request-status
        [loading]="history().loading && !history().value"
        loadingText="Loading valuation history…"
        [error]="history().error"
        retryLabel="Retry history"
        (retry)="load(page())"
      />
      @if (history().value; as h) {
        @if (h.content.length) {
          <div class="tablewrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Valued on</th>
                  <th scope="col">Estimate</th>
                  <th scope="col">80% range</th>
                  <th scope="col">Inputs</th>
                  <th scope="col">Version</th>
                </tr>
              </thead>
              <tbody>
                @for (e of h.content; track e.id) {
                  @let v = e.valuation;
                  <tr>
                    <td>
                      {{ (v.method?.predictionDate | date: 'mediumDate') || '—' }}
                      <div class="smalltext muted">
                        Data through {{ (v.method?.dataThrough | date: 'mediumDate') || '—' }}
                      </div>
                    </td>
                    <td>
                      @if (shows(e)) {
                        <b>{{ estimate(e) | currency: 'USD' : 'symbol' : '1.0-0' }}</b>
                        <div class="smalltext muted">{{ confidence(e) }}</div>
                      } @else {
                        <span class="tag">{{ v.status }}</span>
                      }
                    </td>
                    <td>
                      @if (shows(e) && v.estimate?.range80; as r) {
                        {{ r.low | currency: 'USD' : 'symbol' : '1.0-0' }} –
                        {{ r.high | currency: 'USD' : 'symbol' : '1.0-0' }}
                      } @else {
                        —
                      }
                    </td>
                    <td class="smalltext">
                      @if (e.modelEvidence?.status === 'RECORDED') {
                        @if (e.modelEvidence?.lastSale?.price; as price) {
                          Last sale {{ price | currency: 'USD' : 'symbol' : '1.0-0' }}
                          @if (e.modelEvidence?.lastSale?.date; as d) {
                            ({{ d | date: 'MMM y' }})
                          }
                          <br />
                        }
                        @if (e.modelEvidence?.nearbySales; as n) {
                          @if (n.count) {
                            {{ n.count }} nearby sales, median
                            {{ n.medianPrice | currency: 'USD' : 'symbol' : '1.0-0' }}
                          }
                        }
                      } @else {
                        <span class="muted">Not recorded</span>
                      }
                    </td>
                    <td class="smalltext">
                      <span class="tag" [class.amber]="e.provenance === 'SEEDED_CURRENT'">{{
                        e.provenanceLabel || e.provenance
                      }}</span>
                      <div class="muted">{{ v.method?.modelVersion || '' }}</div>
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
          <p class="sourcedata">
            Inputs are the frozen last sale and nearby sales each model run saw, not today's
            comparables. Versions labelled "recorded before history" were stored before versions
            were archived.
          </p>
        } @else {
          <p class="sub">No earlier valuation of this property has been archived yet.</p>
        }
      }
    </div>
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
  confidence(e: ValuationHistoryEntry) {
    const c = (e.valuation.estimate?.confidence ?? '').toLowerCase();
    return CONFIDENCE[c]?.label ?? 'Confidence not stated';
  }
}
