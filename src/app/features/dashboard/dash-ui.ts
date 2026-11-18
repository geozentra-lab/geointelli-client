import { Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { Icon } from '../../shared/components/icon/icon';
import { PropertyRef } from '../../shared/components/property-ref';
import { labelFor } from '../../shared/pipes/label.pipe';
import { ActivityCardDTO, ActivityType } from '../../core/models/dashboard';
import { DashboardActions } from '../../store/dashboard/dashboard.actions';
import { selectDashboard } from '../../store/dashboard/dashboard.selectors';
import { RecommendationsActions } from '../../store/recommendations/recommendations.actions';
import { selectRecommendations } from '../../store/recommendations/recommendations.selectors';
import { OpportunitiesActions } from '../../store/opportunities/opportunities.actions';
import { selectOpportunities } from '../../store/opportunities/opportunities.selectors';

/** $1.2M / $845K / $920: amounts on KPI tiles, where space is tight. Null stays unavailable. */
export function usdCompact(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M`;
  if (abs >= 1e4) return `${sign}$${Math.round(abs / 1e3)}K`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

/**
 * One KPI tile. Every tile names its scope (caption) and, where the API gives one, its freshness,
 * so a number never stands on its own. A null value shows as unavailable, never as zero.
 */
@Component({
  selector: 'gz-kpi',
  imports: [RouterLink, Icon, NgTemplateOutlet],
  template: `
    @if (link(); as href) {
      <a class="kpi" [routerLink]="href" [queryParams]="query()">
        <ng-container *ngTemplateOutlet="body" />
      </a>
    } @else {
      <div class="kpi"><ng-container *ngTemplateOutlet="body" /></div>
    }
    <ng-template #body>
      <span class="kpi-icon" [class]="'kpi-icon ' + tone()"><gz-icon [name]="icon()" /></span>
      <span class="kpi-label">{{ label() }}</span>
      @if (loading()) {
        <span class="kpi-value skeleton" aria-label="Loading"></span>
      } @else {
        <span class="kpi-value" [class.na]="value() === null">{{ value() ?? '—' }}</span>
      }
      <span class="kpi-caption">{{
        value() === null && !loading() ? unavailable() : caption()
      }}</span>
    </ng-template>
  `,
  host: { class: 'kpi-host' },
})
export class Kpi {
  label = input.required<string>();
  value = input<string | number | null>(null);
  caption = input('');
  unavailable = input('Not available yet');
  icon = input('chart');
  tone = input<'copper' | 'green' | 'ink' | 'amber'>('copper');
  link = input<string | null>(null);
  query = input<Record<string, string> | null>(null);
  loading = input(false);
}

export interface StageRow {
  key: string;
  label: string;
  count: number;
  /** Optional money total shown beside the count (lender volumes). */
  amount?: number | null;
  /** Muted rows are terminal "lost" stages (rejected, cancelled…). */
  muted?: boolean;
}

/**
 * Pipeline as horizontal bars, widest stage = full width. Rows link to the module filtered on that
 * stage, so the chart is a way in, not only a picture.
 */
@Component({
  selector: 'gz-stage-bars',
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    <ol class="stages" [attr.aria-label]="label()">
      @for (r of rows(); track r.key) {
        <li [class.muted]="r.muted" [class.active]="r.key === active()">
          @if (link(); as href) {
            <a [routerLink]="href" [queryParams]="queryFor(r)">
              <ng-container *ngTemplateOutlet="row; context: { $implicit: r }" />
            </a>
          } @else {
            <button
              type="button"
              [attr.aria-pressed]="r.key === active()"
              (click)="picked.emit(r.key === active() ? null : r.key)"
            >
              <ng-container *ngTemplateOutlet="row; context: { $implicit: r }" />
            </button>
          }
        </li>
      }
    </ol>
    <ng-template #row let-r>
      <span class="stage-name">{{ r.label }}</span>
      <span class="stage-track"><span class="stage-fill" [style.width.%]="width(r)"></span></span>
      <span class="stage-count">{{ r.count }}</span>
      @if (r.amount !== undefined) {
        <span class="stage-amount">{{ money(r.amount) }}</span>
      }
    </ng-template>
  `,
})
export class StageBars {
  rows = input.required<StageRow[]>();
  label = input('Pipeline by stage');
  /** Module the rows open (filtered by `param`). Without a link the rows are buttons that emit. */
  link = input<string | null>(null);
  /** In-page mode: the stage currently filtered on, highlighted; clicking it again clears it. */
  active = input<string | null>(null);
  picked = output<string | null>();
  /** Query parameter that carries the stage to the module (e.g. "stage"). */
  param = input<string | null>(null);
  private max = computed(() => Math.max(1, ...this.rows().map((r) => r.count)));
  width(r: StageRow) {
    return r.count ? Math.max(4, (r.count / this.max()) * 100) : 0;
  }
  queryFor(r: StageRow) {
    const p = this.param();
    return p ? { [p]: r.key } : null;
  }
  money(v: number | null | undefined) {
    return usdCompact(v) ?? '—';
  }
}

const ACTIVITY: Record<ActivityType, { verb: string; icon: string }> = {
  FAVORITE_ADDED: { verb: 'Saved a property', icon: 'heart' },
  SAVED_SEARCH_CREATED: { verb: 'Saved a search', icon: 'search' },
  SAVED_SEARCH_UPDATED: { verb: 'Updated a saved search', icon: 'search' },
  ALERT_RULE_CREATED: { verb: 'Created an alert rule', icon: 'bell' },
  ALERT_RULE_UPDATED: { verb: 'Updated an alert rule', icon: 'bell' },
  PORTFOLIO_CREATED: { verb: 'Created a portfolio', icon: 'brief' },
  PORTFOLIO_UPDATED: { verb: 'Updated a portfolio', icon: 'brief' },
  HOLDING_ADDED: { verb: 'Added a holding', icon: 'home' },
  HOLDING_UPDATED: { verb: 'Updated a holding', icon: 'home' },
};
type ActivityItem = ActivityCardDTO['recent'][number];

/**
 * The user's own recent actions (GET /dashboards/user/activity): favorites, saved searches, alert
 * rules, portfolios and holdings, each a stored record with its stored time. Deletions and views
 * are not recorded, and the card says so instead of implying a complete history.
 */
@Component({
  selector: 'gz-recent-activity',
  imports: [DatePipe, RouterLink, Icon, PropertyRef],
  template: `
    <section class="panel dash-card" aria-labelledby="card-activity">
      <div class="panelhead">
        <h3 id="card-activity">Recent activity</h3>
        <a class="smalltext" routerLink="/saved">Saved items</a>
      </div>
      @let c = card();
      @if (c.loading && !c.value) {
        @for (i of [1, 2, 3]; track i) {
          <div class="row-skeleton"></div>
        }
      } @else if (c.error && !c.value) {
        <p class="sub" role="alert">Activity could not be loaded. {{ c.error }}</p>
        <button type="button" class="btn small spacer" (click)="reload()">Retry</button>
      } @else if (c.value; as a) {
        <ul class="feed">
          @for (item of a.recent; track item.type + item.entityId + item.occurredAt) {
            <li>
              <a [routerLink]="link(item)">
                <span class="feed-dot"><gz-icon [name]="meta(item).icon" /></span>
                <span class="feed-text">
                  <b>{{ meta(item).verb }}</b>
                  <small>
                    @if (item.propertyId !== null) {
                      <gz-property-ref [propertyId]="item.propertyId" [link]="false" />
                    } @else {
                      {{ item.label }}
                    }
                  </small>
                </span>
                <time class="smalltext muted" [attr.datetime]="item.occurredAt">{{
                  item.occurredAt | date: 'MMM d'
                }}</time>
              </a>
            </li>
          } @empty {
            <li class="empty-line">
              Nothing yet. Saved properties, searches, alert rules and portfolios show up here.
            </li>
          }
        </ul>
        <p class="sourcedata">Additions and changes only; deletions and views are not recorded.</p>
      }
    </section>
  `,
})
export class RecentActivity {
  private store = inject(Store);
  private dashboard = this.store.selectSignal(selectDashboard);
  card = computed(() => this.dashboard().activity);
  meta(item: ActivityItem) {
    return ACTIVITY[item.type] ?? { verb: labelFor(item.type), icon: 'clock' };
  }
  link(item: ActivityItem): string | (string | number)[] {
    if (item.type === 'FAVORITE_ADDED' && item.propertyId !== null)
      return ['/property', item.propertyId];
    if (item.type.startsWith('SAVED_SEARCH')) return '/saved';
    if (item.type.startsWith('ALERT_RULE')) return '/alerts';
    return '/portfolio';
  }
  /** The card loads with the other user cards (DashboardActions.load). */
  reload() {
    this.store.dispatch(DashboardActions.load());
  }
}

const RECOMMENDATION_EMPTY: Record<string, string> = {
  NO_PREFERENCES: 'Add a budget and target counties in your preferences to get matches.',
  LOCATION_REQUIRED: 'Add at least one target county in your preferences to get matches.',
  NO_MATCHES: 'No property matches your saved budget and counties right now.',
};

/**
 * Property suggestions from the user's saved preferences (GET /recommendations). Reads the same
 * store slice as the Opportunities page, so both always show the same suggestions.
 */
@Component({
  selector: 'gz-recommended',
  imports: [DatePipe, RouterLink, Icon],
  template: `
    <section class="panel dash-card" aria-labelledby="card-recommended">
      <div class="panelhead">
        <div>
          <h3 id="card-recommended">{{ title() }}</h3>
          @if (recs().response; as r) {
            <p class="smalltext muted">
              Matched to your budget{{ r.appliedCountyIds.length ? ' and target counties' : '' }}
              @if (r.sourceAsOf) {
                · records as of {{ r.sourceAsOf | date: 'mediumDate' }}
              }
            </p>
          }
        </div>
        <a class="smalltext" routerLink="/opportunities" [queryParams]="{ view: 'matches' }"
          >View all</a
        >
      </div>
      @if (recs().loading && !recs().response) {
        <div class="rec-grid">
          @for (i of placeholders(); track i) {
            <div class="rec skeleton-card"></div>
          }
        </div>
      } @else if (recs().error && !recs().response) {
        <p class="sub" role="alert">Suggestions could not be loaded.</p>
        <button type="button" class="btn small" (click)="load()">Retry</button>
      } @else if (recs().response; as r) {
        @if (items().length) {
          <div class="rec-grid" [class.compact]="compact()">
            @for (item of items(); track item.property.id) {
              <a class="rec trace" [routerLink]="['/property', item.property.id]">
                <span class="rec-rank">#{{ item.rank }}</span>
                <b class="rec-address">{{
                  item.property.address || 'Folio ' + item.property.folio
                }}</b>
                <span class="smalltext muted">
                  {{ item.property.city || item.property.countyName }}
                  @if (item.property.bedrooms !== null) {
                    · {{ item.property.bedrooms }} bd
                  }
                  @if (item.property.bathrooms !== null) {
                    · {{ item.property.bathrooms }} ba
                  }
                  @if (item.property.livingAreaSqft) {
                    · {{ item.property.livingAreaSqft }} sqft
                  }
                </span>
                @if (item.reasons.length) {
                  <span class="rec-reasons">
                    @for (reason of item.reasons.slice(0, 2); track reason) {
                      <span class="tag"><gz-icon name="check" />{{ reason }}</span>
                    }
                  </span>
                }
              </a>
            }
          </div>
          @if (r.status === 'PARTIAL' || r.limitations.length) {
            <p class="sourcedata">{{ r.limitations.join(' ') }}</p>
          }
        } @else {
          <div class="empty-state">
            <gz-icon name="spark" />
            <p>{{ emptyText(r.status) }}</p>
            <a class="btn small" routerLink="/settings">Set preferences</a>
          </div>
        }
      }
    </section>
  `,
})
export class Recommended {
  private store = inject(Store);
  title = input('Recommended for you');
  limit = input(6);
  compact = input(false);
  recs = this.store.selectSignal(selectRecommendations);
  items = computed(() => this.recs().response?.content.slice(0, this.limit()) ?? []);
  placeholders = computed(() => Array.from({ length: Math.min(this.limit(), 6) }, (_, i) => i));
  constructor() {
    // Reuse suggestions the Opportunities page already loaded this session.
    if (!this.recs().response && !this.recs().loading) this.load();
  }
  load() {
    this.store.dispatch(RecommendationsActions.load({ limit: RECOMMENDATION_LIMIT }));
  }
  emptyText(status: string) {
    return RECOMMENDATION_EMPTY[status] ?? 'No suggestions yet.';
  }
}
/** The page and the dashboard ask for the same list, so the store holds one answer. */
export const RECOMMENDATION_LIMIT = 20;

const OPPORTUNITY_EMPTY: Record<string, string> = {
  NOT_SCORED: 'Opportunity scores have not been calculated yet.',
  NO_ELIGIBLE_OPPORTUNITIES: 'No property has enough valuation evidence to be scored yet.',
  NO_MATCHES: 'No scored property matches these filters.',
};
export function opportunityEmptyText(status: string) {
  return OPPORTUNITY_EMPTY[status] ?? 'No scored opportunities yet.';
}

/**
 * The best-scored properties (GET /opportunities, highest score first). Scores are built from the
 * stored ZentraValue valuation and forecasts; they are research input, not advice.
 */
@Component({
  selector: 'gz-top-opportunities',
  imports: [DecimalPipe, RouterLink, Icon],
  template: `
    <section class="panel dash-card" aria-labelledby="card-top-opportunities">
      <div class="panelhead">
        <div>
          <h3 id="card-top-opportunities">Top-scored opportunities</h3>
          @if (top().value; as p) {
            <p class="smalltext muted">From ZentraValue forecasts · scoring {{ p.scoreVersion }}</p>
          }
        </div>
        <a class="smalltext" routerLink="/opportunities">View all</a>
      </div>
      @if (top().loading && !top().value) {
        <div class="rec-grid compact">
          @for (i of placeholders(); track i) {
            <div class="rec skeleton-card"></div>
          }
        </div>
      } @else if (top().error && !top().value) {
        <p class="sub" role="alert">Opportunities could not be loaded. {{ top().error }}</p>
        <button type="button" class="btn small spacer" (click)="load()">Retry</button>
      } @else if (top().value; as p) {
        @if (p.results.content.length) {
          <div class="rec-grid compact">
            @for (o of p.results.content; track o.propertyId) {
              <a class="rec trace" [routerLink]="['/property', o.propertyId]">
                <span class="rec-rank"
                  >Score {{ o.score | number: '1.0-0' }} / {{ o.maxScore }}</span
                >
                <b class="rec-address">{{ o.address || 'Folio ' + o.folio }}</b>
                <span class="smalltext muted">
                  {{ o.city || o.countyName }}
                  @if (money(o.estimatedValue); as v) {
                    · {{ v }}
                  }
                  @if (o.forecastGrowth1yPct !== null) {
                    · {{ o.forecastGrowth1yPct > 0 ? '+' : ''
                    }}{{ o.forecastGrowth1yPct | number: '1.1-1' }}% in 1 year
                  }
                </span>
              </a>
            }
          </div>
        } @else {
          <div class="empty-state">
            <gz-icon name="chart" />
            <p>{{ emptyText(p.status) }}</p>
          </div>
        }
      }
    </section>
  `,
})
export class TopOpportunities {
  private store = inject(Store);
  size = input(4);
  private opportunities = this.store.selectSignal(selectOpportunities);
  top = computed(() => this.opportunities().top);
  placeholders = computed(() => Array.from({ length: this.size() }, (_, i) => i));
  constructor() {
    effect(() => {
      const size = this.size();
      untracked(() => this.load(size));
    });
  }
  load(size = this.size()) {
    this.store.dispatch(OpportunitiesActions.loadTop({ size }));
  }
  money = usdCompact;
  emptyText = opportunityEmptyText;
}
