import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { PropertyCard } from '../../shared/components/property-card';
import { Pagination } from '../../shared/components/pagination';
import { CountyPicker } from '../../shared/components/county-picker';
import { Icon } from '../../shared/components/icon/icon';
import { RecommendationsActions as R } from '../../store/recommendations/recommendations.actions';
import { selectRecommendations } from '../../store/recommendations/recommendations.selectors';
import { OpportunitiesActions as O } from '../../store/opportunities/opportunities.actions';
import { selectOpportunities } from '../../store/opportunities/opportunities.selectors';
import { OPPORTUNITY_PAGE_SIZE } from '../../store/opportunities/opportunities.reducer';
import { selectLocations } from '../../store/locations/locations.selectors';
import { RecommendationStatus } from '../../core/models/api';
import { OPPORTUNITY_SORTS, OpportunityItem, OpportunitySort } from '../../core/models/opportunity';
import { RECOMMENDATION_LIMIT, opportunityEmptyText, usdCompact } from '../dashboard/dash-ui';

type View = 'scored' | 'matches';

/**
 * Two ways in: properties ranked by their opportunity score (public, from the stored ZentraValue
 * evidence), and suggestions matched to the user's saved counties, budget and goals.
 */
@Component({
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    PageHeading,
    RequestStatus,
    PropertyCard,
    Pagination,
    CountyPicker,
    Icon,
  ],
  template: `<gz-heading
      eyebrow="OPPORTUNITIES"
      title="Find the properties worth a closer look."
      subtitle="Ranked by the evidence behind each ZentraValue, or matched to your own goals."
    >
      @if (view() === 'matches') {
        <a class="btn" routerLink="/settings">Edit preferences</a>
        @if (w.auth.isLoggedIn()) {
          <button
            type="button"
            class="btn primary"
            [disabled]="recs().loading"
            (click)="loadMatches()"
          >
            {{ recs().loading ? 'Refreshing…' : 'Refresh' }}
          </button>
        }
      }
    </gz-heading>
    <div class="tabs" role="tablist" aria-label="Opportunities">
      @for (t of tabs; track t[0]) {
        <button
          type="button"
          role="tab"
          [id]="'opp-tab-' + t[0]"
          [attr.aria-selected]="view() === t[0]"
          aria-controls="opp-panel"
          [attr.tabindex]="view() === t[0] ? 0 : -1"
          [class.active]="view() === t[0]"
          (click)="show(t[0])"
          (keydown)="onTabKey($event)"
        >
          {{ t[1] }}
        </button>
      }
    </div>
    <div role="tabpanel" id="opp-panel" [attr.aria-labelledby]="'opp-tab-' + view()">
      @if (view() === 'scored') {
        <form class="panel filterbar" #ff="ngForm" (ngSubmit)="ff.valid && applyFilters()">
          <div class="formfield location">
            <span class="field-label">Location</span>
            <gz-county-picker />
          </div>
          <div class="formfield">
            <label for="opp-min-score">Minimum score</label>
            <input
              id="opp-min-score"
              name="minScore"
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="Any"
              [(ngModel)]="minScore"
            />
          </div>
          <div class="formfield">
            <label for="opp-min-value">Value from ($)</label>
            <input
              id="opp-min-value"
              name="minValue"
              type="number"
              min="0"
              step="1000"
              placeholder="Any"
              [(ngModel)]="minValue"
            />
          </div>
          <div class="formfield">
            <label for="opp-max-value">Value up to ($)</label>
            <input
              id="opp-max-value"
              name="maxValue"
              type="number"
              min="0"
              step="1000"
              placeholder="Any"
              [(ngModel)]="maxValue"
            />
          </div>
          <div class="formfield">
            <label for="opp-sort">Sort by</label>
            <select id="opp-sort" name="sort" [(ngModel)]="sort">
              @for (o of sorts; track o[0]) {
                <option [value]="o[0]">{{ o[1] }}</option>
              }
            </select>
          </div>
          <button class="btn primary" [disabled]="ff.invalid || valueRangeInvalid()">Apply</button>
          @if (filtered()) {
            <button type="button" class="linkbtn" (click)="resetFilters()">Clear filters</button>
          }
        </form>
        @if (valueRangeInvalid()) {
          <p class="field-error">The lowest value must not be above the highest.</p>
        }
        <gz-request-status
          [loading]="opp().results.loading && !opp().results.value"
          loadingText="Ranking scored properties…"
          [error]="opp().results.error"
          (retry)="browse(opp().query.page)"
        />
        @if (opp().results.value; as r) {
          @if (r.results.content.length) {
            <p class="sub section">
              {{ r.results.totalElements | number }} scored properties · scoring
              {{ r.scoreVersion }}
            </p>
            <div class="propertygrid section" #results tabindex="-1" aria-label="Scored properties">
              @for (o of r.results.content; track o.propertyId) {
                <a class="panel opp trace" [routerLink]="['/property', o.propertyId]">
                  <span class="opp-head">
                    <span
                      class="opp-score"
                      [attr.aria-label]="'Score ' + o.score + ' of ' + o.maxScore"
                      >{{ o.score | number: '1.0-0' }}<small>/{{ o.maxScore }}</small></span
                    >
                    <span class="opp-meter" aria-hidden="true"
                      ><span
                        class="cov"
                        [style.width.%]="(o.coveragePercent / o.maxScore) * 100"
                      ></span
                      ><span class="pts" [style.width.%]="(o.score / o.maxScore) * 100"></span
                    ></span>
                  </span>
                  <b class="opp-address">{{ o.address || 'Folio ' + o.folio }}</b>
                  <span class="smalltext muted">{{ place(o) }}</span>
                  <span class="opp-facts">
                    <span
                      ><small class="muted">ZentraValue</small
                      ><b>{{ money(o.estimatedValue) ?? '—' }}</b></span
                    >
                    <span
                      ><small class="muted">1-year forecast</small
                      ><b
                        [class.green]="(o.forecastGrowth1yPct ?? 0) > 0"
                        [class.amber]="(o.forecastGrowth1yPct ?? 0) < 0"
                        >{{ growth(o.forecastGrowth1yPct) }}</b
                      ></span
                    >
                    <span
                      ><small class="muted">Evidence</small
                      ><b>{{ o.coveragePercent | number: '1.0-0' }}%</b></span
                    >
                  </span>
                  <span class="rec-reasons">
                    @for (f of strongest(o); track f.code) {
                      <span class="tag"><gz-icon name="check" />{{ f.label }}</span>
                    }
                  </span>
                </a>
              }
            </div>
            <gz-pagination
              [page]="r.results.page"
              [pages]="r.results.totalPages"
              [total]="r.results.totalElements"
              [loading]="opp().results.loading"
              (changed)="browse($event)"
            />
          } @else {
            <div class="panel section empty-state">
              <gz-icon name="chart" />
              <p>{{ emptyText(r.status) }}</p>
              @if (filtered()) {
                <button type="button" class="btn small" (click)="resetFilters()">
                  Clear filters
                </button>
              }
            </div>
          }
          @for (note of r.notes; track note) {
            <p class="sourcedata">{{ note }}</p>
          }
        }
      } @else if (!w.auth.isLoggedIn()) {
        <div class="panel section guest-notice">
          <h3>Get suggestions tailored to you.</h3>
          <p class="sub spacer">
            Sign in and save your target counties to see matching property records.
          </p>
          <button type="button" class="btn primary spacer" (click)="w.signIn()">Sign in</button>
        </div>
      } @else {
        <gz-request-status
          [loading]="recs().loading && !recs().response"
          loadingText="Finding matching properties…"
          [error]="recs().error"
          (retry)="loadMatches()"
        />
        @if (recs().response; as r) {
          @if (guidance(); as g) {
            <div class="panel section">
              <h3>{{ g.title }}</h3>
              <p class="sub spacer">{{ g.text }}</p>
              <a class="btn primary spacer" [routerLink]="g.link">{{ g.action }}</a>
            </div>
          }
          @if (r.content.length) {
            <div class="panel section">
              <div class="panelhead">
                <h3>{{ r.content.length }} suggestions</h3>
                <span
                  class="tag"
                  [class.green]="r.status === 'READY'"
                  [class.amber]="r.status === 'PARTIAL'"
                  >{{
                    r.status === 'READY'
                      ? 'All preferences applied'
                      : 'Some preferences not applied'
                  }}</span
                >
              </div>
              <p class="sub">
                @if (r.minBudget !== null || r.maxBudget !== null) {
                  Budget
                  {{
                    r.minBudget === null
                      ? 'any'
                      : (r.minBudget | currency: 'USD' : 'symbol' : '1.0-0')
                  }}
                  –
                  {{
                    r.maxBudget === null
                      ? 'any'
                      : (r.maxBudget | currency: 'USD' : 'symbol' : '1.0-0')
                  }}
                  ·
                }
                {{ r.appliedCountyIds.length }}
                {{ r.appliedCountyIds.length === 1 ? 'county' : 'counties' }} · Generated
                {{ r.generatedAt | date: 'medium' }}
              </p>
              @for (note of r.limitations; track note) {
                <p class="insight section">{{ note }}</p>
              }
            </div>
            <div class="propertygrid section">
              @for (item of r.content; track item.property.id) {
                <div class="opportunity">
                  <gz-property-card [home]="w.home(item.property.id) || item.property" />
                  <ul
                    class="reasons"
                    [attr.aria-label]="'Why property ' + item.rank + ' was suggested'"
                  >
                    @for (reason of item.reasons; track reason) {
                      <li>{{ reason }}</li>
                    }
                    @if (item.budgetMatch) {
                      <li>Budget: {{ item.budgetMatch }}</li>
                    }
                    @if (item.goalMatch) {
                      <li>Goals: {{ item.goalMatch }}</li>
                    }
                  </ul>
                </div>
              }
            </div>
            <p class="sourcedata">
              {{ r.rankingMethod || 'Ranked by county match' }}. Suggestions are property records,
              not active listings or prices.
              @if (r.source) {
                Source: {{ r.source }}
                @if (r.sourceAsOf) {
                  ({{ r.sourceAsOf | date: 'mediumDate' }})
                }
              }
            </p>
          }
        }
      }
    </div>`,
  styles: `
    .filterbar {
      margin-top: 18px;
    }
    .opportunity {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .reasons {
      margin: 0;
      padding: 0 4px 0 20px;
      font-size: 12px;
      color: var(--ink-2);
      line-height: 1.6;
    }
    .opp {
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--ink);
    }
    .opp-head {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .opp-score {
      font:
        800 26px Manrope,
        sans-serif;
      font-variant-numeric: tabular-nums;
      color: var(--copper);
    }
    .opp-score small {
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
    }
    .opp-meter {
      position: relative;
      flex: 1;
      height: 8px;
      border-radius: 99px;
      background: #f0f2f3;
      overflow: hidden;
    }
    .opp-meter span {
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: 99px;
    }
    .opp-meter .cov {
      background: #e8d5c6;
    }
    .opp-meter .pts {
      background: var(--copper);
    }
    .opp-address {
      font-size: 15px;
      line-height: 1.3;
    }
    .opp-facts {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      padding: 10px 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }
    .opp-facts span {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .opp-facts b {
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class Opportunities implements OnInit {
  w = inject(Workspace);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  recs = this.w.store.selectSignal(selectRecommendations);
  opp = this.w.store.selectSignal(selectOpportunities);
  private locations = this.w.store.selectSignal(selectLocations);
  readonly tabs: [View, string][] = [
    ['scored', 'Top scored'],
    ['matches', 'Matched to you'],
  ];
  readonly sorts = OPPORTUNITY_SORTS;
  view = signal<View>(
    this.route.snapshot.queryParamMap.get('view') === 'matches' ? 'matches' : 'scored',
  );
  minScore: number | null = this.opp().query.minScore ?? null;
  minValue: number | null = this.opp().query.minValue ?? null;
  maxValue: number | null = this.opp().query.maxValue ?? null;
  sort: OpportunitySort = this.opp().query.sort ?? 'SCORE_DESC';
  filtered = computed(() => {
    const q = this.opp().query;
    return [q.countyId, q.stateId, q.minScore, q.minValue, q.maxValue].some(
      (v) => v !== null && v !== undefined,
    );
  });
  private copy: Partial<
    Record<RecommendationStatus, { title: string; text: string; action: string; link: string }>
  > = {
    NO_PREFERENCES: {
      title: 'Tell us what you are looking for.',
      text: 'Save your target counties, budget and goals to receive tailored suggestions.',
      action: 'Set preferences',
      link: '/settings',
    },
    LOCATION_REQUIRED: {
      title: 'Add at least one target county.',
      text: 'Suggestions are matched by location first. Budget and goals alone are not enough.',
      action: 'Add counties',
      link: '/settings',
    },
    NO_MATCHES: {
      title: 'No property records in your counties yet.',
      text: 'Try adding nearby counties, or browse all property records.',
      action: 'Explore properties',
      link: '/explore',
    },
  };
  guidance = computed(() => {
    const status = this.recs().response?.status;
    return status ? (this.copy[status] ?? null) : null;
  });
  ngOnInit() {
    this.open(this.view());
  }
  show(view: View) {
    if (view === this.view()) return;
    this.view.set(view);
    // Keep the tab in the address so a refresh or a shared link opens the same one.
    this.router.navigate([], {
      queryParams: { view: view === 'matches' ? 'matches' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.open(view);
  }
  private open(view: View) {
    if (view === 'scored' && !this.opp().results.value) this.browse(0);
    if (view === 'matches' && this.w.auth.isLoggedIn() && !this.recs().response) this.loadMatches();
  }
  onTabKey(event: KeyboardEvent) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next: View = this.view() === 'scored' ? 'matches' : 'scored';
    const target = event.key === 'Home' ? 'scored' : event.key === 'End' ? 'matches' : next;
    this.show(target);
    document.getElementById('opp-tab-' + target)?.focus();
  }
  valueRangeInvalid() {
    return this.minValue !== null && this.maxValue !== null && this.minValue > this.maxValue;
  }
  /** Filters in the form, with the county picker's state and county. */
  applyFilters() {
    if (this.valueRangeInvalid()) return;
    const l = this.locations();
    this.w.store.dispatch(
      O.browse({
        query: {
          page: 0,
          size: OPPORTUNITY_PAGE_SIZE,
          sort: this.sort,
          stateId: l.stateId,
          countyId: l.countyId,
          minScore: this.minScore,
          minValue: this.minValue,
          maxValue: this.maxValue,
        },
      }),
    );
  }
  resetFilters() {
    this.minScore = this.minValue = this.maxValue = null;
    this.sort = 'SCORE_DESC';
    this.w.store.dispatch(
      O.browse({ query: { page: 0, size: OPPORTUNITY_PAGE_SIZE, sort: 'SCORE_DESC' } }),
    );
  }
  browse(page: number) {
    this.w.store.dispatch(O.browse({ query: { ...this.opp().query, page } }));
  }
  loadMatches() {
    if (this.w.requireAccount('see suggestions'))
      this.w.store.dispatch(R.load({ limit: RECOMMENDATION_LIMIT }));
  }
  money = usdCompact;
  emptyText = opportunityEmptyText;
  growth(pct: number | null) {
    return pct === null ? '—' : (pct > 0 ? '+' : '') + pct.toFixed(1) + '%';
  }
  place(o: OpportunityItem) {
    return [o.city, o.countyName && o.stateCode ? `${o.countyName}, ${o.stateCode}` : o.countyName]
      .filter(Boolean)
      .join(' · ');
  }
  /** The two factors that earned the most points, as reasons for the rank. */
  strongest(o: OpportunityItem) {
    return [...o.factors]
      .filter((f) => f.status === 'AVAILABLE' && (f.points ?? 0) > 0)
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
      .slice(0, 2);
  }
}
