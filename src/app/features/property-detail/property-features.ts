import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { PropertyInsightsActions as A } from '../../store/property-insights/property-insights.actions';
import { selectPropertyInsights } from '../../store/property-insights/property-insights.selectors';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { Property } from '../../core/models/property';
import { RECORD_KIT } from '../../shared/components/record';
import { TABLE_KIT } from '../../shared/table';

const NOT_IN_RECORD = 'Not in the county record';

/**
 * Building & features tab: the county's extra features (pools, patios, fences…) from
 * GET /properties/id/{id}/extra-features and, for buildings, their units from /children.
 */
@Component({
  selector: 'gz-property-features',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    RouterLink,
    RequestStatus,
    Pagination,
    ...RECORD_KIT,
    ...TABLE_KIT,
  ],
  template: `
    <gz-record-section heading="Extra features">
      <div class="pf-head">
        <p class="pf-lede">
          @if (features().value; as f) {
            @if (f.history) {
              Every roll year on record
            } @else if (f.rollYear) {
              {{ f.rollYear }} roll year
            } @else {
              Latest roll year
            }
            · {{ f.totalElements }} {{ f.totalElements === 1 ? 'feature' : 'features' }}
          } @else {
            Pools, patios, fences and other extras the county assesses.
          }
        </p>
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
        [loading]="features().loading && !features().value"
        loadingText="Loading extra features…"
        [error]="features().error"
        retryLabel="Retry features"
        (retry)="loadFeatures(featurePage())"
      />
      @if (features().value; as f) {
        @if (f.features.length) {
          <div [attr.aria-busy]="features().loading">
            <table gz-table sticky="none">
              <caption class="sr-only">
                Extra features
              </caption>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  @if (f.history) {
                    <th scope="col" class="num">Roll year</th>
                  }
                  <th scope="col" class="num" data-priority="2">Units</th>
                  <th scope="col" class="num" data-priority="2">Built</th>
                  <th scope="col" class="num" data-priority="3">Condition</th>
                  <th scope="col" class="num">Depreciated value</th>
                </tr>
              </thead>
              <tbody>
                @for (x of f.features; track $index) {
                  <tr>
                    <td
                      gz-cell
                      class="wrap"
                      [missing]="!(x.description || x.useCode)"
                      [reason]="notInRecord"
                    >
                      {{ x.description || x.useCode }}
                    </td>
                    @if (f.history) {
                      <td gz-cell class="num" [missing]="x.rollYear === null" [reason]="notInRecord">
                        {{ x.rollYear }}
                      </td>
                    }
                    <td
                      gz-cell
                      class="num"
                      data-priority="2"
                      [missing]="x.units === null"
                      [reason]="notInRecord"
                    >
                      {{ x.units | number }}
                    </td>
                    <td
                      gz-cell
                      class="num"
                      data-priority="2"
                      [missing]="x.actualYearBuilt === null"
                      [reason]="notInRecord"
                    >
                      {{ x.actualYearBuilt }}
                    </td>
                    <td
                      gz-cell
                      class="num"
                      data-priority="3"
                      [missing]="x.percentCondition === null"
                      [reason]="notInRecord"
                    >
                      {{ x.percentCondition }}%
                    </td>
                    <td
                      gz-cell
                      class="num nowrap"
                      [missing]="x.depreciatedValue === null"
                      [reason]="notInRecord"
                    >
                      {{ x.depreciatedValue | currency: 'USD' : 'symbol' : '1.0-0' }}
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
          <p class="table-note">
            County assessor records. Unavailable: not in the county record. Depreciated value is
            the assessor’s figure for the feature, already part of the assessment; it is not added
            to the market estimate.
          </p>
        } @else {
          <p class="pf-empty">No extra features are on record for this property.</p>
        }
      }
    </gz-record-section>

    @if (units().value; as u) {
      @if (u.totalElements > 0) {
        <gz-record-section heading="Units in this building">
          <p class="pf-lede pf-gap">{{ u.totalElements | number }} on record.</p>
          <table gz-table sticky="none">
            <caption class="sr-only">
              Units in this building
            </caption>
            <thead>
              <tr>
                <th scope="col">Unit</th>
                <th scope="col" class="num">Beds</th>
                <th scope="col" class="num" data-priority="2">Baths</th>
                <th scope="col" class="num" data-priority="2">Living area, sq ft</th>
                <th scope="col" data-priority="3">Use</th>
              </tr>
            </thead>
            <tbody>
              @for (c of u.content; track c.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/property', c.id]">{{ unitLabel(c) }}</a>
                  </td>
                  <td
                    gz-cell
                    class="num"
                    [missing]="c.bedroomCount == null"
                    [reason]="notInRecord"
                  >
                    {{ c.bedroomCount }}
                  </td>
                  <td
                    gz-cell
                    class="num"
                    data-priority="2"
                    [missing]="c.bathroomCount == null"
                    [reason]="notInRecord"
                  >
                    {{ c.bathroomCount }}
                  </td>
                  <td
                    gz-cell
                    class="num"
                    data-priority="2"
                    [missing]="!c.buildingActualArea"
                    [reason]="notInRecord"
                  >
                    {{ c.buildingActualArea | number }}
                  </td>
                  <td
                    gz-cell
                    data-priority="3"
                    [missing]="!c.dorDescription"
                    [reason]="notInRecord"
                  >
                    {{ c.dorDescription }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <gz-pagination
            [page]="u.page"
            [pages]="u.totalPages"
            [total]="u.totalElements"
            [loading]="units().loading"
            (changed)="loadUnits($event)"
          />
        </gz-record-section>
      }
    }
    <gz-request-status
      [error]="units().error"
      retryLabel="Retry units"
      (retry)="loadUnits(unitsPage())"
    />
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--sp-24);
      min-width: 0;
    }
    :host > * {
      min-width: 0;
    }
    .pf-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-8) var(--sp-16);
      margin-bottom: var(--sp-8);
    }
    .pf-lede {
      margin: 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
    }
    .pf-gap {
      margin-bottom: var(--sp-8);
    }
    .pf-empty {
      margin: 0;
      font-size: var(--fs-body);
      color: var(--ink-2);
    }
    td.wrap {
      white-space: normal;
    }
  `,
})
export class PropertyFeatures {
  private store = inject(Store);
  readonly notInRecord = NOT_IN_RECORD;
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
