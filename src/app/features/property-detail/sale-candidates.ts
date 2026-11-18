import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { PropertyInsightsActions as A } from '../../store/property-insights/property-insights.actions';
import { selectPropertyInsights } from '../../store/property-insights/property-insights.selectors';
import { ComparableCandidate } from '../../core/models/api';
import { RequestStatus } from '../../shared/components/request-status';

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
  imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule, RouterLink, RequestStatus],
  template: `
    <div class="panel section">
      <div class="panelhead">
        <h3>Nearby qualified sales</h3>
        @if (result().value; as r) {
          <span class="smalltext muted"
            >{{ r.returnedCount }} {{ r.returnedCount === 1 ? 'sale' : 'sales' }} since
            {{ r.saleDateFrom | date: 'MMM y' }}</span
          >
        }
      </div>
      <p class="sub">
        All recorded arm's-length sales that pass these filters, nearest first. They are not ranked
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
        @if (r.status === 'INSUFFICIENT_DATA') {
          <p class="insight warning section" role="status">
            Only {{ r.returnedCount }} of the {{ r.minimumCandidates }} sales needed for reliable
            comparison were found. Try a wider radius or a longer period.
          </p>
        }
        @for (w of r.warnings; track w) {
          <p class="sourcedata">{{ w }}</p>
        }
        @if (!r.candidates.length) {
          <p class="sub spacer">No recorded sale matches these filters. Try widening them.</p>
        } @else {
          <div class="tablewrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Address</th>
                  <th scope="col">Sold</th>
                  <th scope="col">Price</th>
                  <th scope="col">Beds / baths</th>
                  <th scope="col">Living area</th>
                  <th scope="col">Distance</th>
                  <th scope="col">Match</th>
                </tr>
              </thead>
              <tbody>
                @for (c of r.candidates; track c.saleId) {
                  <tr>
                    <td>
                      <a [routerLink]="['/property', c.propertyId]">{{
                        c.address || 'Folio ' + c.folio
                      }}</a>
                    </td>
                    <td>{{ c.saleDate | date: 'mediumDate' }}</td>
                    <td>{{ c.salePrice | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
                    <td>{{ c.bedrooms ?? '—' }} / {{ c.bathrooms ?? '—' }}</td>
                    <td>
                      {{ c.livingAreaSqft ? (c.livingAreaSqft | number: '1.0-0') + ' sqft' : '—' }}
                    </td>
                    <td>{{ distance(c) }}</td>
                    <td>
                      <span class="tag" [title]="c.qualificationDescription || ''">{{
                        match(c)
                      }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <p class="sourcedata">
          Selection {{ r.selectionVersion }} · sales on record up to
          {{ r.asOfDate | date: 'mediumDate' }}
        </p>
      }
    </div>
  `,
  styles: `
    .candidate-filters {
      margin: 14px 0;
    }
    .candidate-filters .formfield {
      flex: 0 1 160px;
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
  distance(c: ComparableCandidate) {
    const m = c.distanceMeters;
    if (m === null || m === undefined) return '—';
    return (m / 1609.344).toFixed(m < 1609 ? 2 : 1) + ' mi';
  }
}
