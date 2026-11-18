import { LabelPipe } from '../../shared/pipes/label.pipe';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DecimalPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { ComparablesActions as A } from '../../store/comparables/comparables.actions';
import { PropertyCompareActions } from '../../store/property-compare/property-compare.actions';
import { SideBySide } from './side-by-side';
import { PropertyPicker } from '../../shared/components/property-picker';
import { selectComparables } from '../../store/comparables/comparables.selectors';
@Component({
  imports: [
    FormsModule,
    RouterLink,
    CurrencyPipe,
    DecimalPipe,
    DatePipe,
    PageHeading,
    RequestStatus,
    SideBySide,
    PropertyPicker,
    LabelPipe,
  ],
  template: `<gz-heading
      eyebrow="COMPARE"
      title="Weigh properties against the evidence."
      subtitle="Put up to five properties side by side, or review ranked comparable sales for one."
    />
    <div class="tabs" role="tablist" aria-label="Comparison type">
      @for (t of tabs; track t[0]) {
        <button
          type="button"
          role="tab"
          [id]="'compare-tab-' + t[0]"
          [attr.aria-selected]="tab() === t[0]"
          aria-controls="compare-panel"
          [attr.tabindex]="tab() === t[0] ? 0 : -1"
          [class.active]="tab() === t[0]"
          (keydown)="onTabKey($event)"
          (click)="tab.set(t[0])"
        >
          {{ t[1] }}
        </button>
      }
    </div>
    <div role="tabpanel" id="compare-panel" [attr.aria-labelledby]="'compare-tab-' + tab()">
      @if (tab() === 'side') {
        <gz-side-by-side />
      } @else {
        <form class="filterbar section" (ngSubmit)="load()">
          <gz-property-picker
            class="sales-picker"
            label="Property"
            [propertyId]="id"
            (selected)="pick($event)"
          />
          <div class="formfield">
            <label for="compRadius">Radius (meters)</label
            ><input
              id="compRadius"
              name="radius"
              type="number"
              min="100"
              max="10000"
              [(ngModel)]="radius"
              required
            />
          </div>
          <div class="formfield">
            <label for="compMonths">Sale history (months)</label
            ><input
              id="compMonths"
              name="months"
              type="number"
              min="1"
              max="120"
              [(ngModel)]="months"
              required
            />
          </div>
          <button class="btn primary" [disabled]="!valid() || state().loading">
            Compare sales
          </button>
        </form>
        <gz-request-status [loading]="state().loading" [error]="state().error" (retry)="load()" />
        @if (id && state().propertyId === id ? state().response : null; as r) {
          <div class="panel">
            <div class="panelhead">
              <h3>{{ r.returnedCount }} comparable transactions</h3>
              <span class="tag" [class.amber]="r.status !== 'COMPARABLES_FOUND'">{{
                r.status | label
              }}</span>
            </div>
            <p class="sub">
              As of {{ r.asOfDate | date }} · {{ r.consideredCandidates }} candidates considered
            </p>
            @for (warning of r.warnings; track warning) {
              <p class="insight section">{{ warning }}</p>
            }
            <div class="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Recorded sale</th>
                    <th>Date</th>
                    <th>Similarity</th>
                    <th>Evidence coverage</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of r.comparables; track c.candidate.saleId) {
                    <tr>
                      <td>
                        <a [routerLink]="['/property', c.candidate.propertyId]">{{
                          c.candidate.address || c.candidate.folio
                        }}</a>
                        <p class="sourcedata">{{ c.selectionReasons.join(' · ') }}</p>
                        @if (c.missingData.length) {
                          <p class="sourcedata">Missing: {{ c.missingData.join(', ') }}</p>
                        }
                      </td>
                      <td>{{ c.candidate.salePrice | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
                      <td>{{ c.candidate.saleDate | date: 'mediumDate' }}</td>
                      <td>{{ c.similarityScore | number: '1.0-1' }}</td>
                      <td>{{ c.evidenceCoveragePercent }}%</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5">
                        No comparable sales match these criteria. Try a wider radius or longer
                        history.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="sourcedata">
              {{ r.selectionVersion }} · {{ r.rankingVersion }}. Comparable rankings are not
              appraisals or price estimates.
            </p>
          </div>
        } @else if (!id) {
          <div class="empty section">
            Search for a property by address, or open a property record and choose Compare.<a
              class="btn spacer"
              routerLink="/explore"
              >Explore properties</a
            >
          </div>
        }
      }
    </div>`,
  styles: `
    .sales-picker {
      flex: 1 1 100%;
    }
  `,
})
export class Compare {
  w = inject(Workspace);
  router = inject(Router);
  params = toSignal(inject(ActivatedRoute).paramMap);
  query = toSignal(inject(ActivatedRoute).queryParamMap);
  readonly tabs = [
    ['side', 'Side by side'],
    ['sales', 'Comparable sales'],
  ] as const;
  tab = signal<'side' | 'sales'>('side');
  state = this.w.store.selectSignal(selectComparables);
  id: number | null = null;
  radius = 2000;
  months = 24;
  constructor() {
    effect(() => {
      const id = Number(this.params()?.get('id'));
      if (Number.isSafeInteger(id) && id > 0) {
        this.tab.set('sales');
        this.id = id;
        untracked(() => this.load());
      }
    });
    // Shareable links: /compare?ids=12,34 restores and runs a side-by-side comparison.
    effect(() => {
      const ids = (this.query()?.get('ids') ?? '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isSafeInteger(n) && n > 0);
      if (!ids.length) return;
      untracked(() => {
        this.tab.set('side');
        this.w.store.dispatch(PropertyCompareActions.setSelection({ propertyIds: ids }));
        if (ids.length >= 2) this.w.store.dispatch(PropertyCompareActions.load());
      });
    });
  }
  onTabKey(event: KeyboardEvent) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = this.tab() === 'side' ? 'sales' : 'side';
    const target = event.key === 'Home' ? 'side' : event.key === 'End' ? 'sales' : next;
    this.tab.set(target);
    document.getElementById('compare-tab-' + target)?.focus();
  }
  valid() {
    return (
      this.id !== null &&
      Number.isSafeInteger(this.id) &&
      this.id > 0 &&
      Number.isInteger(this.radius) &&
      this.radius >= 100 &&
      this.radius <= 10000 &&
      Number.isInteger(this.months) &&
      this.months >= 1 &&
      this.months <= 120
    );
  }
  pick(id: number | null) {
    this.id = id;
    if (id) this.load();
  }
  load() {
    if (this.valid())
      this.w.store.dispatch(
        A.load({
          id: this.id!,
          query: { radiusMeters: this.radius, months: this.months, limit: 20 },
        }),
      );
  }
}
