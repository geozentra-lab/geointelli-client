import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { PropertyInsightsActions as A } from '../../store/property-insights/property-insights.actions';
import { selectPropertyInsights } from '../../store/property-insights/property-insights.selectors';
import { ComparableCandidate } from '../../core/models/api';
import { RequestStatus } from '../../shared/components/request-status';
import { RECORD_KIT } from '../../shared/components/record';
import { TABLE_KIT } from '../../shared/table';
import { formatRecordDate } from '../../shared/data/format';

const MATCH_LABELS: Record<string, string> = {
  SAME_PARENT_GROUP: 'Same building',
  SAME_SUBDIVISION: 'Same subdivision',
  SAME_NEIGHBORHOOD: 'Same neighborhood',
  NEARBY: 'Nearby',
};

/**
 * Every recent qualified sale around the home that passes the filters, nearest first
 * (GET /properties/id/{id}/comparables/candidates). Unlike the ranked comparables above, these are
 * not scored or adjusted: it lets a user widen or narrow the search and see the raw sale evidence.
 */
@Component({
  selector: 'gz-sale-candidates',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    RequestStatus,
    ...RECORD_KIT,
    ...TABLE_KIT,
  ],
  template: `
    <gz-record-section heading="Nearby qualified sales">
      <p class="sc-lede">
        All recorded arm’s-length sales that pass these filters, nearest first. They are not ranked
        or adjusted for differences, unlike the comparables above.
      </p>
      <form class="filterbar candidate-filters" (ngSubmit)="search()">
        <div class="formfield">
          <label for="candRadius">Within</label
          ><select id="candRadius" name="radius" [(ngModel)]="radiusMeters">
            @for (r of radii; track r[0]) {
              <option [ngValue]="r[0]">{{ r[1] }}</option>
            }
          </select>
        </div>
        <div class="formfield">
          <label for="candMonths">Sold in the last</label
          ><select id="candMonths" name="months" [(ngModel)]="months">
            @for (m of monthOptions; track m) {
              <option [ngValue]="m">{{ m }} months</option>
            }
          </select>
        </div>
        <div class="formfield">
          <label for="candArea">Size within</label
          ><select id="candArea" name="area" [(ngModel)]="areaTolerancePercent">
            @for (a of areaOptions; track a) {
              <option [ngValue]="a">±{{ a }}%</option>
            }
          </select>
        </div>
        <div class="formfield">
          <label for="candBeds">Bedrooms within</label
          ><select id="candBeds" name="beds" [(ngModel)]="bedroomTolerance">
            @for (b of bedOptions; track b) {
              <option [ngValue]="b">±{{ b }}</option>
            }
          </select>
        </div>
        <button class="btn" [disabled]="result().loading">Update</button>
      </form>
      <gz-request-status
        [loading]="result().loading"
        loadingText="Finding recent sales…"
        [error]="result().error"
        retryLabel="Retry sales"
        (retry)="search()"
      />
      @if (result().value; as r) {
        <p class="sc-count">
          {{ r.returnedCount }} {{ r.returnedCount === 1 ? 'sale' : 'sales' }}
          @if (day(r.saleDateFrom); as from) {
            since {{ from }}
          }
        </p>
        @if (r.status === 'INSUFFICIENT_DATA') {
          <p class="sc-caution" role="status">
            Only {{ r.returnedCount }} of the {{ r.minimumCandidates }} sales needed for a reliable
            comparison were found. Try a wider radius or a longer period.
          </p>
        }
        @if (!r.candidates.length) {
          <p class="sc-empty">No recorded sale matches these filters. Try widening them.</p>
        } @else {
          <table gz-table sticky="none">
            <caption class="sr-only">
              Nearby qualified sales, nearest first
            </caption>
            <thead>
              <tr>
                <th scope="col">Address</th>
                <th scope="col" class="num" data-priority="2">Sold</th>
                <th scope="col" class="num">Price</th>
                <th scope="col" class="num" data-priority="3">Beds</th>
                <th scope="col" class="num" data-priority="3">Baths</th>
                <th scope="col" class="num" data-priority="3">Living area, sq ft</th>
                <th scope="col" class="num" data-priority="2">Distance</th>
              </tr>
            </thead>
            <tbody>
              @for (c of r.candidates; track c.saleId) {
                <tr>
                  <td>
                    <a [routerLink]="['/property', c.propertyId]">{{
                      c.address || 'Folio ' + c.folio
                    }}</a>
                    <span class="cell-sub">{{ match(c) }}</span>
                  </td>
                  <td gz-cell class="num nowrap" data-priority="2" [missing]="!day(c.saleDate)" reason="Not in the sale record">
                    {{ day(c.saleDate) }}
                  </td>
                  <td gz-cell class="num nowrap" [missing]="c.salePrice == null" reason="Not in the sale record">
                    {{ c.salePrice | currency: 'USD' : 'symbol' : '1.0-0' }}
                  </td>
                  <td gz-cell class="num" data-priority="3" [missing]="c.bedrooms == null" reason="Not in the county record">
                    {{ c.bedrooms }}
                  </td>
                  <td gz-cell class="num" data-priority="3" [missing]="c.bathrooms == null" reason="Not in the county record">
                    {{ c.bathrooms }}
                  </td>
                  <td gz-cell class="num" data-priority="3" [missing]="!c.livingAreaSqft" reason="Not in the county record">
                    {{ c.livingAreaSqft | number: '1.0-0' }}
                  </td>
                  <td gz-cell class="num nowrap" data-priority="2" [missing]="distance(c) === null" reason="Not returned for this sale">
                    {{ distance(c) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
        @for (w of r.warnings; track w) {
          <p class="table-note">{{ w }}</p>
        }
        <p class="table-note">
          @if (day(r.asOfDate); as d) {
            Sales on record up to {{ d }}.
          }
          @if (anyMissing(r.candidates)) {
            Unavailable: not in the county record.
          }
        </p>
        @if (r.selectionVersion) {
          <details class="sc-method">
            <summary>Method</summary>
            <gz-record-group>
              <div gz-record-row label="Selection">{{ r.selectionVersion }}</div>
            </gz-record-group>
          </details>
        }
      }
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .sc-lede,
    .sc-count {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .sc-count {
      margin: var(--sp-12) 0 0;
      color: var(--ink);
      font-weight: 500;
    }
    .candidate-filters {
      margin: var(--sp-12) 0 0;
    }
    .candidate-filters .formfield {
      flex: 0 1 160px;
    }
    .sc-caution {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-cell);
      color: var(--attention);
      max-width: var(--measure);
    }
    .sc-empty {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-body);
      color: var(--ink-2);
    }
    table {
      margin-top: var(--sp-8);
    }
    .sc-method {
      margin-top: var(--sp-12);
      font-size: var(--fs-cell);
    }
    .sc-method summary {
      cursor: pointer;
      color: var(--copper);
      font-weight: 500;
    }
    .sc-method gz-record-group {
      max-width: 480px;
    }
  `,
})
export class SaleCandidates {
  private store = inject(Store);
  propertyId = input.required<number>();
  private insights = this.store.selectSignal(selectPropertyInsights);
  result = computed(() =>
    this.insights().propertyId === this.propertyId()
      ? this.insights().candidates
      : { value: null, loading: true, error: null },
  );
  readonly radii: [number, string][] = [
    [800, '0.5 mi'],
    [2000, '1.25 mi'],
    [5000, '3 mi'],
    [10000, '6 mi'],
  ];
  readonly monthOptions = [6, 12, 24, 36, 60];
  readonly areaOptions = [10, 25, 50];
  readonly bedOptions = [0, 1, 2];
  // Backend defaults, so the first view matches the comparables search.
  radiusMeters = 2000;
  months = 24;
  areaTolerancePercent = 25;
  bedroomTolerance = 1;
  constructor() {
    effect(() => {
      this.propertyId();
      untracked(() => this.search());
    });
  }
  search() {
    this.store.dispatch(
      A.loadCandidates({
        propertyId: this.propertyId(),
        query: {
          radiusMeters: this.radiusMeters,
          months: this.months,
          areaTolerancePercent: this.areaTolerancePercent,
          bedroomTolerance: this.bedroomTolerance,
          limit: 50,
        },
      }),
    );
  }
  match(c: ComparableCandidate) {
    return MATCH_LABELS[c.matchLevel] ?? c.matchLevel.replace(/_/g, ' ').toLowerCase();
  }
  day(value: string | null | undefined) {
    return formatRecordDate(value);
  }
  /** Whether any shown cell is the Unavailable marker, so its reason is written under the table. */
  anyMissing(rows: readonly ComparableCandidate[]) {
    return rows.some(
      (c) =>
        !this.day(c.saleDate) ||
        c.salePrice == null ||
        c.bedrooms == null ||
        c.bathrooms == null ||
        !c.livingAreaSqft ||
        c.distanceMeters == null,
    );
  }
  distance(c: ComparableCandidate) {
    const m = c.distanceMeters;
    if (m === null || m === undefined) return null;
    return (m / 1609.344).toFixed(m < 1609 ? 2 : 1) + ' mi';
  }
}
