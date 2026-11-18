import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { PropertyInsightsActions as A } from '../../store/property-insights/property-insights.actions';
import { selectPropertyInsights } from '../../store/property-insights/property-insights.selectors';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { Property } from '../../core/models/property';

/**
 * Building & features tab: the county's extra features (pools, patios, fences…) from
 * GET /properties/id/{id}/extra-features and, for buildings, their units from /children.
 */
@Component({
  selector: 'gz-property-features',
  imports: [CurrencyPipe, DecimalPipe, RouterLink, RequestStatus, Pagination],
  template: `
    <div class="panel">
      <div class="panelhead">
        <h3>Extra features</h3>
        <div class="toggle" role="group" aria-label="Which roll years">
          <button
            type="button"
            [class.active]="!history()"
            [attr.aria-pressed]="!history()"
            (click)="showHistory(false)"
          >
            Latest roll
          </button>
          <button
            type="button"
            [class.active]="history()"
            [attr.aria-pressed]="history()"
            (click)="showHistory(true)"
          >
            All years
          </button>
        </div>
      </div>
      <gz-request-status
        [loading]="features().loading"
        loadingText="Loading extra features…"
        [error]="features().error"
        retryLabel="Retry features"
        (retry)="loadFeatures(featurePage())"
      />
      @if (features().value; as f) {
        @if (f.features.length) {
          <p class="smalltext muted">
            @if (f.history) {
              Every roll year on record
            } @else if (f.rollYear) {
              {{ f.rollYear }} roll year
            }
            · {{ f.totalElements }} {{ f.totalElements === 1 ? 'feature' : 'features' }}
          </p>
          <div class="tablewrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  @if (f.history) {
                    <th scope="col">Roll year</th>
                  }
                  <th scope="col">Units</th>
                  <th scope="col">Built</th>
                  <th scope="col">Condition</th>
                  <th scope="col">Depreciated value</th>
                </tr>
              </thead>
              <tbody>
                @for (x of f.features; track $index) {
                  <tr>
                    <td>{{ x.description || x.useCode || 'Unnamed feature' }}</td>
                    @if (f.history) {
                      <td>{{ x.rollYear ?? '—' }}</td>
                    }
                    <td>{{ x.units === null ? '—' : (x.units | number) }}</td>
                    <td>{{ x.actualYearBuilt ?? '—' }}</td>
                    <td>{{ x.percentCondition === null ? '—' : x.percentCondition + '%' }}</td>
                    <td>
                      {{
                        x.depreciatedValue === null
                          ? 'Not available'
                          : (x.depreciatedValue | currency: 'USD' : 'symbol' : '1.0-0')
                      }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <gz-pagination
            [page]="f.page"
            [pages]="f.totalPages"
            [total]="f.totalElements"
            [loading]="features().loading"
            (changed)="loadFeatures($event)"
          />
          <p class="sourcedata">
            County assessor records. Depreciated value is the assessor's figure for the feature,
            already part of the assessment; it is not added to the market estimate.
          </p>
        } @else {
          <p class="sub spacer">No extra features are on record for this property.</p>
        }
      }
    </div>

    @if (units().value; as u) {
      @if (u.totalElements > 0) {
        <div class="panel section">
          <div class="panelhead">
            <h3>Units in this building</h3>
            <span class="smalltext muted">{{ u.totalElements | number }} on record</span>
          </div>
          <div class="tablewrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Unit</th>
                  <th scope="col">Beds</th>
                  <th scope="col">Baths</th>
                  <th scope="col">Living area</th>
                  <th scope="col">Use</th>
                </tr>
              </thead>
              <tbody>
                @for (c of u.content; track c.id) {
                  <tr>
                    <td>
                      <a [routerLink]="['/property', c.id]">{{ unitLabel(c) }}</a>
                    </td>
                    <td>{{ c.bedroomCount ?? '—' }}</td>
                    <td>{{ c.bathroomCount ?? '—' }}</td>
                    <td>
                      {{ c.buildingActualArea ? (c.buildingActualArea | number) + ' sqft' : '—' }}
                    </td>
                    <td>{{ c.dorDescription || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <gz-pagination
            [page]="u.page"
            [pages]="u.totalPages"
            [total]="u.totalElements"
            [loading]="units().loading"
            (changed)="loadUnits($event)"
          />
        </div>
      }
    }
    <gz-request-status
      [error]="units().error"
      retryLabel="Retry units"
      (retry)="loadUnits(unitsPage())"
    />
  `,
})
export class PropertyFeatures {
  private store = inject(Store);
  propertyId = input.required<number>();
  private insights = this.store.selectSignal(selectPropertyInsights);
  /** The slice's sections, only while they belong to this property. */
  private mine = computed(() =>
    this.insights().propertyId === this.propertyId() ? this.insights() : null,
  );
  features = computed(() => this.mine()?.features ?? { value: null, loading: true, error: null });
  units = computed(() => this.mine()?.units ?? { value: null, loading: true, error: null });
  history = computed(() => this.mine()?.featuresQuery.history ?? false);
  featurePage = computed(() => this.mine()?.featuresQuery.page ?? 0);
  unitsPage = computed(() => this.mine()?.unitsPage ?? 0);
  constructor() {
    effect(() => {
      const propertyId = this.propertyId();
      untracked(() => {
        this.store.dispatch(A.loadFeatures({ propertyId, history: false, page: 0 }));
        this.loadUnits(0);
      });
    });
  }
  showHistory(history: boolean) {
    if (history === this.history()) return;
    this.store.dispatch(A.loadFeatures({ propertyId: this.propertyId(), history, page: 0 }));
  }
  loadFeatures(page: number) {
    this.store.dispatch(
      A.loadFeatures({ propertyId: this.propertyId(), history: this.history(), page }),
    );
  }
  loadUnits(page: number) {
    this.store.dispatch(A.loadUnits({ propertyId: this.propertyId(), page }));
  }
  unitLabel(c: Partial<Property>) {
    const unit = c.address?.unit;
    return unit ? 'Unit ' + unit : c.address?.address || 'Folio ' + c.folio;
  }
}
