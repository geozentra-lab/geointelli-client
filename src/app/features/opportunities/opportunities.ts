import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { CountyPicker } from '../../shared/components/county-picker';
import { CompareToggle } from '../../shared/components/compare-toggle';
import { Reasons } from '../../shared/components/reasons';
import { Desk } from '../../shared/layout/desk';
import { RecordPane } from '../../shared/layout/record-pane';
import { Sort, TABLE_KIT } from '../../shared/table';
import { countOf, formatFolio, placeLine } from '../../shared/data/format';
import { OpportunitiesActions as O } from '../../store/opportunities/opportunities.actions';
import { selectOpportunities } from '../../store/opportunities/opportunities.selectors';
import {
  OPPORTUNITY_PAGE_SIZE,
  OpportunitiesState,
} from '../../store/opportunities/opportunities.reducer';
import { selectLocations } from '../../store/locations/locations.selectors';
import { LocationsActions } from '../../store/locations/locations.actions';
import {
  OPPORTUNITY_SORTS,
  OpportunityItem,
  OpportunityPageDTO,
  OpportunityQuery,
  OpportunitySort,
} from '../../core/models/opportunity';
import { splitVersionNotes } from '../../shared/components/score-factors';
import { RECOMMENDATION_LIMIT, opportunityEmptyText } from '../dashboard/dash-ui';
import { Matches } from './matches';
import { OpportunityRecord } from './opportunity-record';
import {
  SORT_COLUMNS,
  confidenceLow,
  confidenceText,
  opportunityPlace,
  opportunityTitle,
  scoreShare,
  signedPercent,
  sortFromColumn,
  strongestFactors,
} from './opportunity-rows';

type View = 'scored' | 'matches';
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Opportunities (DESIGN.md §7, §8): two ways in.
 *
 * - Top scored: properties ranked by their stored opportunity score (public, GET /opportunities),
 *   as a ranked register: rank, property, score with how much the evidence covers, ZentraValue
 *   with its confidence line, the one-year forecast and the strongest evidence. The API's four
 *   orders are the sortable columns (and the Sort select on phones). Opening a row puts its score,
 *   factors and valuation in the Desk's record pane (docked, a sheet, or its own page by width).
 * - Matched to you: `gz-matches`, the suggestions from the saved area and budget.
 *
 * Reads the existing opportunities, recommendations, locations and valuation slices and dispatches
 * their existing actions only.
 */
@Component({
  imports: [
    CurrencyPipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    PageHeading,
    CountyPicker,
    CompareToggle,
    Reasons,
    Desk,
    RecordPane,
    Matches,
    OpportunityRecord,
    ...TABLE_KIT,
  ],
  template: `<gz-desk [open]="paneShown()" [label]="paneLabel()" (closed)="closePane()">
      <gz-heading
        title="Opportunities"
        [subtitle]="subtitle()"
      />
      <div class="tabs" role="tablist" aria-label="Opportunities">
        @for (t of tabs(); track t[0]) {
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
      <div
        role="tabpanel"
        id="opp-panel"
        tabindex="-1"
        [attr.aria-labelledby]="'opp-tab-' + view()"
      >
        @if (view() === 'scored') {
          <button
            type="button"
            class="btn opp-filter-toggle"
            aria-controls="opp-filters"
            [attr.aria-expanded]="filtersOpen()"
            (click)="filtersOpen.set(!filtersOpen())"
          >
            {{ filtersOpen() ? 'Hide filters' : 'Filters' }}
            @if (activeFilters()) {
              <span class="num">({{ activeFilters() }})</span>
            }
          </button>
          <form
            id="opp-filters"
            class="filterbar opp-filters"
            [class.open]="filtersOpen()"
            role="search"
            aria-label="Filter scored properties"
            #ff="ngForm"
            (ngSubmit)="ff.valid && applyFilters()"
          >
            <div class="formfield location">
              <span class="field-label">Location</span>
              <gz-county-picker />
            </div>
            <div class="formfield opp-num">
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
            <div class="formfield opp-num">
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
            <div class="formfield opp-num">
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
            <div class="formfield opp-sort">
              <label for="opp-sort">Sort by</label>
              <!-- Sorting runs at once on the applied filters; it never reads the unapplied form. -->
              <select
                id="opp-sort"
                [ngModel]="appliedSort()"
                [ngModelOptions]="{ standalone: true }"
                (ngModelChange)="sortTo($event)"
              >
                @for (o of sorts; track o[0]) {
                  <option [value]="o[0]">{{ o[1] }}</option>
                }
              </select>
            </div>
            <div class="opp-apply">
              <button class="btn primary" [disabled]="ff.invalid || valueRangeInvalid()">Apply</button>
              <!-- An empty table offers its own Clear filters. -->
              @if (filtered() && rows().length) {
                <button type="button" class="btn" (click)="resetFilters()">Clear filters</button>
              }
            </div>
          </form>
          @if (valueRangeInvalid()) {
            <p class="field-error">The lowest value must not be above the highest.</p>
          } @else if (ff.invalid) {
            <p class="field-error">The minimum score runs from 0 to 100; values can’t be below $0.</p>
          }

          @if (opp().results.error && !opp().results.loading) {
            <div class="insight danger opp-alert" role="alert">
              <span>
                Scored properties could not load.
                @if (opp().results.value) {
                  These are the ones loaded before.
                }
              </span>
              <button type="button" class="btn small" (click)="retry()">Retry</button>
            </div>
          }

          @if (opp().results.value; as r) {
            <div class="opp-results" [attr.aria-busy]="opp().results.loading ? 'true' : null">
              <!-- No "0 scored properties": an empty table says what is missing instead. -->
              <p class="opp-count" tabindex="-1" #count>
                @if (r.results.totalElements) {
                  {{ countText(r.results.totalElements) }}
                }
              </p>
              <table
                gz-table
                class="opp-table"
                [sort]="tableSort()"
                (sortChange)="sortBy($event)"
                [(selected)]="selectedId"
                (activated)="openPane($event)"
                (dismissed)="closePane()"
                [paneOpen]="paneShown()"
              >
                <caption class="sr-only">
                  Scored properties, in the order chosen. Choose a row to see its score and factors.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" class="num opp-rank">Rank</th>
                    <th scope="col">Property</th>
                    <th gz-sort="score" numeric>Score, of 100</th>
                    <th gz-sort="value" numeric data-priority="2">ZentraValue</th>
                    <th gz-sort="forecast" numeric data-priority="2">Next 12 months</th>
                    <th scope="col" data-priority="3" class="opp-why-head">Strongest evidence</th>
                  </tr>
                </thead>
                <tbody>
                  @for (o of r.results.content; track o.propertyId; let i = $index) {
                    <tr [gz-row]="o.propertyId">
                      <td class="num">{{ r.results.page * r.results.size + i + 1 }}</td>
                      <td class="opp-prop">
                        <a class="cell-main" [routerLink]="['/property', o.propertyId]">{{
                          title(o)
                        }}</a>
                        @if (where(o) || o.countyName) {
                          <span class="cell-sub"
                            >{{ where(o) }}
                            @if (o.countyName) {
                              <span class="opp-county">{{ where(o) ? ' · ' : '' }}{{ o.countyName }}</span>
                            }
                          </span>
                        }
                        <span class="cell-sub m-only">{{ phoneValue(o) }}</span>
                        <span class="cell-sub m-only">{{ phoneForecast(o) }}</span>
                      </td>
                      <td class="num opp-score">
                        <span class="score-line"
                          ><span class="scorebar" aria-hidden="true"
                            ><i class="cov" [style.width.%]="share(o.coveragePercent, o.maxScore)"></i
                            ><i class="pts" [style.width.%]="share(o.score, o.maxScore)"></i></span
                          ><b>{{ o.score | number: '1.0-1' }}</b></span
                        >
                        <span class="cell-sub"
                          >Evidence covers {{ o.coveragePercent | number: '1.0-0' }} of
                          {{ o.maxScore }}</span
                        >
                      </td>
                      <td
                        gz-cell
                        class="num nowrap"
                        data-priority="2"
                        [missing]="o.estimatedValue === null"
                        reason="No estimate was stored with this score"
                      >
                        {{ o.estimatedValue | currency: 'USD' : 'symbol' : '1.0-0' }}
                        <span class="cell-sub" [class.attention]="lowConfidence(o)">{{
                          confidence(o)
                        }}</span>
                      </td>
                      <td
                        gz-cell
                        class="num nowrap"
                        data-priority="2"
                        [missing]="o.forecastGrowth1yPct === null"
                        reason="No one-year forecast was stored with this score"
                      >
                        {{ signed(o.forecastGrowth1yPct) }}
                      </td>
                      <td data-priority="3" class="opp-why">
                        @if (strongest(o); as reasons) {
                          @if (reasons.length) {
                            <gz-reasons
                              [reasons]="reasons"
                              [label]="'Strongest evidence for ' + title(o)"
                            />
                          } @else {
                            <span class="muted">No factor earned points.</span>
                          }
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr gz-empty-row [colspan]="6" [message]="emptyText(r.status)">
                      @if (filtered()) {
                        <button type="button" class="btn small" (click)="resetFilters()">
                          Clear filters
                        </button>
                      }
                    </tr>
                  }
                </tbody>
              </table>
              <gz-pager
                [page]="r.results.page"
                [size]="r.results.size"
                [total]="r.results.totalElements"
                [loading]="opp().results.loading"
                (changed)="goTo($event)"
              />
              <div class="opp-notes">
                @if (r.results.content.length) {
                  <p class="table-note">
                    Score bars: ink is the score; grey is the rest of what the evidence on record could
                    earn; the hatch is evidence that isn’t on record, which adds no points. The
                    confidence under a ZentraValue is the valuation’s confidence score and band,
                    from the score’s own factors.
                  </p>
                  @if (anyMissing(r.results.content)) {
                    <p class="table-note">Unavailable: not stored with that property’s score.</p>
                  }
                }
                <!-- Backend notes that name the scoring version go under Method (DESIGN.md §9). -->
                @for (note of notes(r).plain; track note) {
                  <p class="table-note">{{ note }}</p>
                }
              </div>
              <details class="opp-method">
                <summary>Method</summary>
                <p>
                  Scoring version {{ r.scoreVersion }}. Scores are stored, not live: each row says
                  when it was scored in its record.
                </p>
                @for (note of notes(r).method; track note) {
                  <p>{{ note }}</p>
                }
              </details>
            </div>
          } @else if (opp().results.loading) {
            <div class="opp-results" aria-busy="true">
              <p class="sr-only" role="status">Ranking scored properties…</p>
              @for (i of skeletonRows; track i) {
                <div class="row-skeleton" aria-hidden="true"></div>
              }
            </div>
          }
        } @else {
          <gz-matches [requestLimit]="recommendationLimit" [framed]="false" />
        }
      </div>
      @if (paneRow(); as o) {
        <gz-record-pane
          deskSlot
          [heading]="title(o)"
          noun="property"
          backLabel="Opportunities"
          [position]="position()"
          [hasPrev]="paneIndex() > 0"
          [hasNext]="paneIndex() < rows().length - 1"
          (prev)="step(-1)"
          (next)="step(1)"
          (closed)="closePane()"
        >
          @if (place(o); as where) {
            <span paneMeta>{{ where }}</span>
          }
          @if (folio(o); as f) {
            <span paneMeta class="num">Folio {{ f }}</span>
          }
          <div paneActions class="opp-pane-actions">
            <a class="btn" [routerLink]="['/property', o.propertyId]">Open property record</a>
            <gz-compare-toggle [propertyId]="o.propertyId" [label]="title(o)" [small]="false" />
          </div>
          <gz-opportunity-record
            [item]="o"
            [scoreVersion]="opp().results.value?.scoreVersion ?? ''"
            [title]="title(o)"
          />
        </gz-record-pane>
      }
    </gz-desk>`,
  styles: `
    .opp-filters {
      margin-bottom: var(--sp-16);
    }
    .opp-filters .formfield.location {
      flex: 2 1 340px;
    }
    .opp-filters .opp-num {
      flex: 0 1 136px;
    }
    .opp-filters .opp-sort {
      flex: 0 1 200px;
    }
    .opp-apply {
      display: flex;
      gap: var(--sp-8);
    }
    .opp-filter-toggle {
      display: none;
    }
    .field-error {
      margin: calc(-1 * var(--sp-8)) 0 var(--sp-16);
    }
    .opp-alert {
      margin-bottom: var(--sp-16);
    }
    .opp-alert span {
      flex: 1;
      min-width: 0;
    }
    /* Focused only by script (Retry before any results), like the count. */
    #opp-panel:focus {
      outline: none;
    }
    .opp-count {
      /* Paging scrolls it into view: clear of the sticky top bar. */
      scroll-margin-top: calc(var(--topbar-h) + var(--sp-8));
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
      outline: none;
    }
    .opp-rank {
      width: 1%;
    }
    .opp-prop {
      min-width: 168px;
      overflow-wrap: anywhere;
    }
    .opp-prop a {
      color: var(--ink);
    }
    .opp-prop a:hover {
      color: var(--copper);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .opp-score {
      white-space: nowrap;
    }
    .score-line {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-8);
    }
    .score-line b {
      min-width: 4ch;
      font-weight: 600;
    }
    /* Score of 100: ink the score, rule-strong what the evidence could still earn, hatch the
       part no evidence on record covers (DESIGN.md §6 coverage, §11 one hue). */
    .scorebar {
      position: relative;
      display: block;
      width: 64px;
      height: 6px;
      background-color: var(--paper);
      background-image: var(--hatch);
    }
    .scorebar i {
      position: absolute;
      inset: 0 auto 0 0;
    }
    .scorebar .cov {
      background: var(--rule-strong);
    }
    .scorebar .pts {
      background: var(--ink);
    }
    .opp-why-head {
      width: 26%;
    }
    .opp-notes {
      margin-top: var(--sp-4);
    }
    .opp-method {
      margin-top: var(--sp-16);
      font-size: var(--fs-cell);
    }
    .opp-method summary {
      cursor: pointer;
      color: var(--copper);
      font-weight: 500;
    }
    .opp-method p {
      margin: var(--sp-8) 0 0;
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .opp-pane-actions {
      display: contents;
    }
    /* Tablets: the strongest evidence is in the record; the property keeps room to read. */
    @media (max-width: 1023.98px) {
      .opp-why-head,
      .opp-why {
        display: none;
      }
    }
    @media (max-width: 700px) {
      .opp-filter-toggle {
        display: inline-flex;
        gap: 4px;
        margin-bottom: var(--sp-12);
      }
      .opp-filters:not(.open) {
        display: none;
      }
      .opp-filters .formfield.location,
      .opp-filters .opp-sort {
        flex: 1 1 100%;
      }
      .opp-filters .opp-num {
        flex: 1 1 120px;
      }
      .opp-apply {
        flex: 1 1 100%;
      }
      .opp-apply .btn.primary {
        flex: 1;
      }
      /* Two columns and the rank (DESIGN.md §5 registers on phones): the property with its value
         and forecast as second lines, and the score. */
      .opp-county {
        display: none;
      }
      .opp-table .opp-rank,
      .opp-table td:first-child {
        padding-left: 4px;
        padding-right: 4px;
      }
      .opp-score {
        width: 112px;
        white-space: normal;
      }
      .opp-score .scorebar {
        width: 48px;
      }
    }
  `,
})
export class Opportunities {
  w = inject(Workspace);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private injector = inject(Injector);
  opp = this.w.store.selectSignal(selectOpportunities);
  private locations = this.w.store.selectSignal(selectLocations);
  /** Top scored is the investor's (GET /api/opportunities, features.investment); matches are everyone's. */
  readonly investor = computed(() => this.w.features().investment);
  readonly tabs = computed<[View, string][]>(() =>
    this.investor()
      ? [
          ['scored', 'Top scored'],
          ['matches', 'Matched to you'],
        ]
      : [['matches', 'Matched to you']],
  );
  readonly subtitle = computed(() =>
    this.investor()
      ? 'Properties ranked by the evidence behind their ZentraValue, or matched to your area and budget.'
      : 'Properties matched to your area and budget.',
  );
  readonly sorts = OPPORTUNITY_SORTS;
  readonly recommendationLimit = RECOMMENDATION_LIMIT;
  readonly skeletonRows = [0, 1, 2, 3, 4, 5];
  private readonly askedView: View =
    this.route.snapshot.queryParamMap.get('view') === 'matches' ? 'matches' : 'scored';
  view = linkedSignal<View>(() => (this.investor() ? this.askedView : 'matches'));
  minScore: number | null = this.opp().query.minScore ?? null;
  minValue: number | null = this.opp().query.minValue ?? null;
  maxValue: number | null = this.opp().query.maxValue ?? null;
  /** Phones: the filters fold away behind one button. */
  readonly filtersOpen = signal(false);
  filtered = computed(() => this.activeFilters() > 0);
  /** The last query that answered. */
  private readonly answeredQuery = linkedSignal<OpportunitiesState, OpportunityQuery>({
    source: () => this.opp(),
    computation: (s, previous) =>
      (!s.results.loading && !s.results.error) || !previous ? s.query : previous.value,
  });
  /**
   * The query the page describes. The slice takes a new query when its request starts: while it
   * runs, the page shows what was asked for over the dimmed rows. A failed request keeps the rows
   * loaded before, so the count, the filter count and the sort go back to the query that answered,
   * never one that failed.
   */
  private readonly shownQuery = computed(() => {
    // Read every time: a linkedSignal only remembers the states it was read in.
    const answered = this.answeredQuery();
    return this.opp().results.error ? answered : this.opp().query;
  });
  readonly activeFilters = computed(() => {
    const q = this.shownQuery();
    return [q.countyId ?? q.stateId, q.minScore, q.minValue, q.maxValue].filter(
      (v) => v !== null && v !== undefined,
    ).length;
  });

  /** The applied order as the table's sorted column; a click on a one-way column stays honest. */
  readonly appliedSort = computed(
    () => (this.shownQuery().sort ?? 'SCORE_DESC') as OpportunitySort,
  );
  readonly tableSort = linkedSignal<Sort>(() => ({ ...SORT_COLUMNS[this.appliedSort()] }));

  /** The register's record pane (DESIGN.md §5): the selected row, while open. */
  readonly selectedId = signal<unknown>(null);
  private readonly paneOpen = signal(false);
  readonly rows = computed(() => this.opp().results.value?.results.content ?? []);
  readonly paneIndex = computed(() => this.rows().findIndex((o) => o.propertyId === this.selectedId()));
  readonly paneRow = computed(() =>
    this.paneOpen() && this.view() === 'scored' ? (this.rows()[this.paneIndex()] ?? null) : null,
  );
  readonly paneShown = computed(() => this.paneRow() !== null);
  readonly paneLabel = computed(() => {
    const o = this.paneRow();
    return o ? 'Opportunity: ' + this.title(o) : 'Opportunity';
  });
  readonly position = computed(() =>
    this.paneIndex() < 0 ? '' : `${this.paneIndex() + 1} of ${this.rows().length} on this page`,
  );
  private readonly countEl = viewChild<ElementRef<HTMLElement>>('count');
  private focusResults = false;

  constructor() {
    // A record that left the results (a new filter or page) closes its pane.
    effect(() => {
      const open = this.paneOpen();
      const index = this.paneIndex();
      if (open && index < 0) untracked(() => this.paneOpen.set(false));
    });
    // After Previous or Next, the results start from the top and take focus (DESIGN.md §7 paging).
    effect(() => {
      if (this.opp().results.loading || !this.focusResults) return;
      this.focusResults = false;
      untracked(() => {
        const el = this.countEl()?.nativeElement;
        el?.scrollIntoView?.({ block: 'start' });
        el?.focus({ preventScroll: true });
      });
    });
    // Results whenever Top scored has none: on arrival, on coming back to the tab, and after the
    // session ended (sign-out resets every slice, and nothing else would ask again). A failed
    // request waits for Retry.
    effect(() => {
      const r = this.opp().results;
      if (this.view() !== 'scored' || r.value || r.loading || r.error) return;
      untracked(() => this.browse(0));
    });
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
    // A record pane belongs to Top scored: leaving the tab closes it.
    if (view !== 'scored') this.paneOpen.set(false);
  }
  onTabKey(event: KeyboardEvent) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key) || this.tabs().length < 2) return;
    event.preventDefault();
    const next: View = this.view() === 'scored' ? 'matches' : 'scored';
    const target = event.key === 'Home' ? 'scored' : event.key === 'End' ? 'matches' : next;
    this.show(target);
    document.getElementById('opp-tab-' + target)?.focus();
  }

  valueRangeInvalid() {
    return this.minValue !== null && this.maxValue !== null && this.minValue > this.maxValue;
  }
  private fieldsInvalid() {
    const s = this.minScore;
    return (
      (s !== null && (s < 0 || s > 100)) ||
      (this.minValue !== null && this.minValue < 0) ||
      (this.maxValue !== null && this.maxValue < 0)
    );
  }
  /** Filters in the form, with the county picker's state and county. False when they can't run. */
  applyFilters(): boolean {
    if (this.valueRangeInvalid() || this.fieldsInvalid()) return false;
    const l = this.locations();
    this.w.store.dispatch(
      O.browse({
        query: {
          page: 0,
          size: OPPORTUNITY_PAGE_SIZE,
          sort: this.appliedSort(),
          stateId: l.stateId,
          countyId: l.countyId,
          minScore: this.minScore,
          minValue: this.minValue,
          maxValue: this.maxValue,
        },
      }),
    );
    return true;
  }
  /**
   * Re-sorts what is shown: the applied filters with a new order, from the first page. It never
   * reads the form or the location picker (shared with Explore, Settings and the area form), so an
   * unapplied or invalid field can't slip in or block it. The Sort select (phones, where the
   * sortable columns may be hidden) and the headers both come here.
   */
  sortTo(sort: OpportunitySort) {
    if (sort === this.appliedSort()) return;
    this.w.store.dispatch(O.browse({ query: { ...this.shownQuery(), sort, page: 0 } }));
  }
  /** A sortable header: one of the API's four orders, on the server. */
  sortBy(sort: Sort | null) {
    const next = sortFromColumn(sort);
    // A one-way column clicked again keeps its arrow: the table shows the applied order.
    this.tableSort.set({ ...SORT_COLUMNS[next] });
    this.sortTo(next);
  }
  /** Clears the fields, the location picker and the order (the picker is the location filter). */
  resetFilters() {
    // Both Clear filters buttons go once the filters are cleared: focus moves to the results.
    this.focusResults = true;
    this.focusCount();
    this.minScore = this.minValue = this.maxValue = null;
    if (this.locations().stateId !== null)
      this.w.store.dispatch(LocationsActions.selectState({ stateId: null }));
    this.w.store.dispatch(
      O.browse({ query: { page: 0, size: OPPORTUNITY_PAGE_SIZE, sort: 'SCORE_DESC' } }),
    );
  }
  /** A page of the rows on screen (after a failed request, of the ones loaded before). */
  browse(page: number) {
    this.w.store.dispatch(O.browse({ query: { ...this.shownQuery(), page } }));
  }
  /** Asks again for what failed. Retry goes with its alert, so focus moves to the results first. */
  retry() {
    this.focusResults = true;
    this.focusCount();
    this.w.store.dispatch(O.browse({ query: this.opp().query }));
  }
  /** The results' count, or the tab panel while there are no results yet. */
  private focusCount() {
    const el = this.countEl()?.nativeElement ?? document.getElementById('opp-panel');
    el?.focus({ preventScroll: true });
  }
  goTo(page: number) {
    this.focusResults = true;
    this.browse(page);
  }

  openPane(id: unknown) {
    this.selectedId.set(id);
    this.paneOpen.set(true);
  }
  /** Closes the record and gives focus back to its row (as its own page, the list returns). */
  closePane() {
    if (!this.paneOpen()) return;
    this.paneOpen.set(false);
    afterNextRender(
      () => {
        const row = document.querySelector<HTMLElement>('.opp-table tr.gz-row.sel');
        row?.focus({ preventScroll: false });
      },
      { injector: this.injector },
    );
  }
  step(by: number) {
    const next = this.rows()[this.paneIndex() + by];
    if (next) this.selectedId.set(next.propertyId);
  }

  countText(total: number) {
    const n = countOf(total, 'scored property', 'scored properties');
    if (!this.filtered()) return n;
    return `${n} ${total === 1 ? 'matches' : 'match'} these filters`;
  }
  /** Backend notes, with the ones naming the scoring version set apart for Method. */
  notes(r: OpportunityPageDTO) {
    return splitVersionNotes(r.notes, r.scoreVersion);
  }
  emptyText = opportunityEmptyText;
  title = opportunityTitle;
  place = opportunityPlace;
  confidence = confidenceText;
  lowConfidence = confidenceLow;
  signed = (pct: number | null) => signedPercent(pct);
  share = scoreShare;
  folio(o: OpportunityItem) {
    return formatFolio(o.folio);
  }
  strongest(o: OpportunityItem) {
    return strongestFactors(o);
  }
  /** "Miami, FL 33133"; the county follows it in its own span (left out on phones). */
  where(o: OpportunityItem) {
    return placeLine(o.city, o.stateCode, o.zip);
  }
  phoneForecast(o: OpportunityItem) {
    const f = signedPercent(o.forecastGrowth1yPct);
    return f ? f + ' next 12 months' : 'Next 12 months unavailable';
  }
  /** The phone's lines under the address, where the ZentraValue and forecast columns are hidden. */
  phoneValue(o: OpportunityItem) {
    return o.estimatedValue === null
      ? 'ZentraValue unavailable'
      : 'ZentraValue ' + usd.format(o.estimatedValue);
  }
  anyMissing(rows: OpportunityItem[]) {
    return rows.some((o) => o.estimatedValue === null || o.forecastGrowth1yPct === null);
  }
}
