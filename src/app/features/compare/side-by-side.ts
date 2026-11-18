import { placeLine } from '../../shared/data/format';
import { Component, computed, inject } from '@angular/core';
import { PropertyPicker } from '../../shared/components/property-picker';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { RequestStatus } from '../../shared/components/request-status';
import { PropertyCompareActions as A } from '../../store/property-compare/property-compare.actions';
import { selectPropertyCompare } from '../../store/property-compare/property-compare.selectors';
import { COMPARE_MAX, COMPARE_MIN } from '../../store/property-compare/property-compare.reducer';
import { PropertyComparison } from '../../core/models/api';
type Kind = 'text' | 'money' | 'number' | 'date' | 'percent' | 'score';
interface Row {
  label: string;
  path: string;
  kind: Kind;
  /** Higher is better: highlights the best column for quick scanning. */
  best?: 'max' | 'min';
}
const ROWS: { group: string; rows: Row[] }[] = [
  {
    group: 'Facts',
    rows: [
      { label: 'Property type', path: 'facts.propertyType', kind: 'text' },
      { label: 'Bedrooms', path: 'facts.bedrooms', kind: 'number', best: 'max' },
      { label: 'Bathrooms', path: 'facts.bathrooms', kind: 'number', best: 'max' },
      { label: 'Living area (sqft)', path: 'facts.livingAreaSqft', kind: 'number', best: 'max' },
      { label: 'Lot size (sqft)', path: 'facts.lotSizeSqft', kind: 'number', best: 'max' },
      { label: 'Year built', path: 'facts.yearBuilt', kind: 'text' },
      { label: 'Floors', path: 'facts.floors', kind: 'number' },
      { label: 'Units', path: 'facts.units', kind: 'number' },
    ],
  },
  {
    group: 'Assessment',
    rows: [
      { label: 'Assessment year', path: 'assessment.year', kind: 'text' },
      { label: 'Total value', path: 'assessment.totalValue', kind: 'money' },
      { label: 'Land value', path: 'assessment.landValue', kind: 'money' },
      { label: 'Building value', path: 'assessment.buildingValue', kind: 'money' },
      { label: 'Assessed value', path: 'assessment.assessedValue', kind: 'money' },
    ],
  },
  {
    group: 'Last recorded sale',
    rows: [
      { label: 'Sale date', path: 'lastSale.date', kind: 'date' },
      { label: 'Sale price', path: 'lastSale.price', kind: 'money' },
    ],
  },
  {
    group: 'Prediction',
    rows: [
      { label: 'Predicted value', path: 'valuation.predictedPrice', kind: 'money' },
      { label: 'Low', path: 'valuation.low', kind: 'money' },
      { label: 'High', path: 'valuation.high', kind: 'money' },
      {
        label: 'Growth vs last sale',
        path: 'valuation.growthPercentage',
        kind: 'percent',
        best: 'max',
      },
      { label: 'Confidence', path: 'valuation.confidenceScore', kind: 'score', best: 'max' },
    ],
  },
  {
    group: 'Location',
    rows: [
      { label: 'School score', path: 'scores.schoolScore', kind: 'score', best: 'max' },
      {
        label: 'Transportation score',
        path: 'scores.transportationScore',
        kind: 'score',
        best: 'max',
      },
    ],
  },
];
@Component({
  selector: 'gz-side-by-side',
  imports: [PropertyPicker, RouterLink, CurrencyPipe, DatePipe, DecimalPipe, RequestStatus],
  template: `<div class="panel">
      <div class="panelhead">
        <h3>Your selection</h3>
        <span class="tag">{{ state().selection.length }} of {{ max }}</span>
      </div>
      <div class="actions spacer" aria-live="polite">
        @for (id of state().selection; track id) {
          <button
            type="button"
            class="tag"
            (click)="remove(id)"
            [attr.aria-label]="'Remove ' + label(id) + ' from comparison'"
          >
            {{ label(id) }} ×
          </button>
        } @empty {
          <p class="sub">
            Use <strong>+ Compare</strong> on any property card or record, or search by address
            below.
          </p>
        }
      </div>
      <gz-property-picker
        class="spacer"
        mode="add"
        label="Add a property by address"
        [hint]="
          state().selection.length >= max
            ? 'The comparison is full. Remove a property to add another.'
            : 'Type at least 3 characters of the address, then pick a match to add it.'
        "
        [disabled]="state().selection.length >= max"
        [exclude]="state().selection"
        (selected)="add($event)"
      />
      <div class="row spacer">
        <span class="spacer-flex"></span>
        @if (state().selection.length) {
          <button type="button" class="btn" (click)="clear()">Clear</button>
        }
        <button
          type="button"
          class="btn primary"
          [disabled]="state().selection.length < min || state().loading"
          (click)="compare()"
        >
          {{ state().loading ? 'Comparing…' : 'Compare' }}
        </button>
      </div>
    </div>
    <gz-request-status [loading]="state().loading" [error]="state().error" (retry)="compare()" />
    @if (shown(); as r) {
      @for (warning of r.warnings; track warning) {
        <p class="insight section">{{ warning }}</p>
      }
      <div class="tablewrap section">
        <table class="compare-table">
          <caption class="sr-only">
            Side-by-side comparison of
            {{
              r.comparedCount
            }}
            properties
          </caption>
          <thead>
            <tr>
              <th scope="col">Property</th>
              @for (p of r.properties; track p.propertyId) {
                <th scope="col">
                  <a [routerLink]="['/property', p.propertyId]">{{
                    p.address || 'Folio ' + p.folio
                  }}</a>
                  <div class="smalltext muted">{{ place(p.countyName, p.stateCode) }}</div>
                </th>
              }
            </tr>
          </thead>
          @for (g of groups; track g.group) {
            <tbody>
              <tr class="group">
                <th scope="rowgroup" [attr.colspan]="r.properties.length + 1">{{ g.group }}</th>
              </tr>
              @for (row of g.rows; track row.path) {
                <tr>
                  <th scope="row">{{ row.label }}</th>
                  @for (p of r.properties; track p.propertyId) {
                    @let v = value(p, row.path);
                    <td [class.best]="isBest(r.properties, row, v)">
                      @if (v === null || v === undefined || v === '') {
                        <span class="muted" aria-label="Not available">—</span>
                      } @else {
                        @switch (row.kind) {
                          @case ('money') {
                            {{ $any(v) | currency: 'USD' : 'symbol' : '1.0-0' }}
                          }
                          @case ('number') {
                            {{ $any(v) | number: '1.0-1' }}
                          }
                          @case ('date') {
                            {{ $any(v) | date: 'mediumDate' }}
                          }
                          @case ('percent') {
                            {{ $any(v) | number: '1.1-1' }}%
                          }
                          @case ('score') {
                            {{ $any(v) | number: '1.0-0' }}
                          }
                          @default {
                            {{ v }}
                          }
                        }
                      }
                      @if (isBest(r.properties, row, v)) {
                        <span class="sr-only">(best in row)</span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          }
        </table>
      </div>
      <p class="sourcedata">
        Values in {{ r.units['currency'] || 'USD' }}, areas in {{ r.units['area'] || 'sqft' }}.
        @if (r.assessmentYear) {
          Assessments use the shared year {{ r.assessmentYear }}.
        }
        Highlighted cells are the highest value in a row. Predictions are model estimates, and
        assessments are not market values.
      </p>
    } @else if (!state().loading && state().selection.length < min) {
      <div class="empty section">
        Pick {{ min }} to {{ max }} properties to see them side by side.<a
          class="btn spacer"
          routerLink="/explore"
          >Explore properties</a
        >
      </div>
    }`,
  styles: `
    .spacer-flex {
      flex: 1;
    }
    .compare-table th[scope='col'] {
      min-width: 170px;
      vertical-align: top;
    }
    .compare-table tbody th[scope='row'] {
      color: var(--muted);
      font-weight: 500;
      white-space: nowrap;
    }
    .compare-table tr.group th {
      background: #f6f8f8;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-2);
    }
    .compare-table td.best {
      background: var(--success-bg);
      font-weight: 600;
    }
  `,
})
export class SideBySide {
  place = placeLine;
  w = inject(Workspace);
  state = this.w.store.selectSignal(selectPropertyCompare);
  readonly groups = ROWS;
  readonly min = COMPARE_MIN;
  readonly max = COMPARE_MAX;
  /** Hides properties removed since the last comparison instead of showing stale columns. */
  shown = computed(() => {
    const r = this.state().response;
    if (!r) return null;
    const selected = new Set(this.state().selection);
    const properties = r.properties.filter((p) => selected.has(p.propertyId));
    return properties.length >= COMPARE_MIN
      ? { ...r, properties, comparedCount: properties.length }
      : null;
  });
  private names = computed(() => {
    const names: Record<number, string> = {};
    for (const p of this.state().response?.properties ?? []) {
      if (p.address || p.folio) names[p.propertyId] = p.address || 'Folio ' + p.folio;
    }
    return names;
  });
  label(id: number) {
    const home = this.w.home(id);
    return this.names()[id] || home?.address || (home ? 'Folio ' + home.folio : 'Property ' + id);
  }
  value(p: PropertyComparison, path: string): unknown {
    return path
      .split('.')
      .reduce<unknown>((o, key) => (o == null ? null : (o as Record<string, unknown>)[key]), p);
  }
  isBest(properties: PropertyComparison[], row: Row, v: unknown) {
    if (!row.best || typeof v !== 'number' || properties.length < 2) return false;
    const values = properties
      .map((p) => this.value(p, row.path))
      .filter((x): x is number => typeof x === 'number');
    if (values.length < 2 || new Set(values).size === 1) return false;
    return v === (row.best === 'max' ? Math.max(...values) : Math.min(...values));
  }
  add(id: number | null) {
    if (!id) return;
    if (this.state().selection.includes(id)) {
      this.w.toast('That property is already selected.');
      return;
    }
    this.w.store.dispatch(A.toggle({ propertyId: id }));
  }
  remove(id: number) {
    this.w.store.dispatch(A.toggle({ propertyId: id }));
  }
  clear() {
    this.w.store.dispatch(A.clear());
  }
  compare() {
    if (this.state().selection.length >= COMPARE_MIN) this.w.store.dispatch(A.load());
  }
}
