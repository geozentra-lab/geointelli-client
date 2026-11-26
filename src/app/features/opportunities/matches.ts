import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { Reasons } from '../../shared/components/reasons';
import { RECORD_KIT } from '../../shared/components/record';
import { Sort, TABLE_KIT, sortRows } from '../../shared/table';
import {
  countOf,
  formatConfidence,
  formatFolio,
  formatLocalDate,
  isLowConfidence,
  joinParts,
  placeLine,
  plainNotes,
} from '../../shared/data/format';
import { labelFor } from '../../shared/pipes/label.pipe';
import { RecommendationItem, RecommendationResponse } from '../../core/models/api';
import { PropertyValuePrediction } from '../../core/models/property_prediction_value';
import { RecommendationsActions } from '../../store/recommendations/recommendations.actions';
import { selectRecommendations } from '../../store/recommendations/recommendations.selectors';
import { ValuationActions } from '../../store/valuation/valuation.actions';
import { selectValuation } from '../../store/valuation/valuation.selectors';
import { AreaBudgetForm } from './area-budget-form';

/** Ranking methods in plain words (DESIGN.md §13); an unknown one is shown under Method only. */
const RANKING: Record<string, string> = {
  COUNTY_MATCH_THEN_PROPERTY_ID_ASC: 'Target-county match first, then record order',
};
/** Budget and goal checks that say nothing per row: the caption above the table covers them. */
const SILENT_MATCH = new Set(['UNKNOWN', 'NOT_REQUESTED']);

let nextId = 0;

/** "a", "a and b", "a, b and c". */
function listOf(items: string[]): string {
  return items.length < 2 ? (items[0] ?? '') : items.slice(0, -1).join(', ') + ' and ' + items.at(-1);
}

/**
 * Matches for your search (DESIGN.md §8, the buyer lead): suggestions from the saved area and
 * budget (GET /recommendations) as a ranked table of address, beds, living area, ZentraValue and
 * reasons. READY and PARTIAL show the table (PARTIAL says which preferences were not applied);
 * NO_PREFERENCES and LOCATION_REQUIRED show "Set your area and budget" instead of "0 matches";
 * NO_MATCHES says so and links to the preferences. Used by the Opportunities page's "Matched to
 * you" tab, and meant for the buyer overview (`[limit]="5"` shows the top rows and "See all").
 *
 * It loads the suggestions itself when signed in and none are held (also after preferences are
 * saved, which drops them), and the ZentraValues of its rows once per set of rows with the existing
 * bulk prediction action, as Explore does. Recommendations carry no estimate of their own.
 */
@Component({
  selector: 'gz-matches',
  host: { '[class.bare]': '!framed()' },
  imports: [
    CurrencyPipe,
    DecimalPipe,
    RouterLink,
    Reasons,
    AreaBudgetForm,
    ...RECORD_KIT,
    ...TABLE_KIT,
  ],
  template: `
    @let r = recs().response;
    @if (!signedIn()) {
      <section class="mt-block" [attr.aria-labelledby]="id + '-title'">
        <h2 [id]="id + '-title'" tabindex="-1">{{ heading() }}</h2>
        <p class="mt-text">Sign in to see properties matched to your area and budget.</p>
        <div class="mt-buttons">
          <button type="button" class="btn primary" (click)="w.signIn()">Sign in</button>
          <button type="button" class="btn" (click)="w.signUp()">Create account</button>
        </div>
      </section>
    } @else if (!r) {
      <section class="mt-block" [attr.aria-labelledby]="id + '-title'" [attr.aria-busy]="busy()">
        <h2 [id]="id + '-title'" tabindex="-1">{{ heading() }}</h2>
        @if (recs().error && !recs().loading) {
          <div class="insight danger mt-alert" role="alert">
            <span>Matches could not load.</span>
            <button type="button" class="btn small" (click)="retryLoad()">Retry</button>
          </div>
        } @else {
          <p class="sr-only" role="status">Finding matches…</p>
          @for (i of skeletonRows; track i) {
            <div class="row-skeleton" aria-hidden="true"></div>
          }
        }
      </section>
    } @else if (r.status === 'NO_PREFERENCES' || r.status === 'LOCATION_REQUIRED') {
      <gz-area-budget-form [status]="r.status" [framed]="framed()" [attr.aria-busy]="busy()" />
    } @else if (!r.content.length) {
      <section class="mt-block" [attr.aria-labelledby]="id + '-title'" [attr.aria-busy]="busy()">
        <h2 [id]="id + '-title'" tabindex="-1">No matches for these preferences</h2>
        <p class="mt-text">{{ noMatchText(r) }}</p>
        <div class="mt-buttons">
          <a class="btn primary" routerLink="/settings">Edit preferences</a>
          <a class="btn" routerLink="/explore">Explore properties</a>
        </div>
      </section>
    } @else {
      <section class="mt" [attr.aria-labelledby]="id + '-title'" [attr.aria-busy]="busy()">
        <div class="mt-head">
          <div>
            <h2 [id]="id + '-title'" tabindex="-1">{{ heading() }}</h2>
            <p class="mt-count">
              {{ countText(r) }}
              @if (updated(r); as u) {
                · Updated {{ u }}
              }
            </p>
          </div>
          <div class="mt-buttons">
            <a class="btn" routerLink="/settings">Edit preferences</a>
            <!-- aria-disabled, not disabled: a disabled button drops the focus it holds. -->
            <button
              type="button"
              class="btn"
              [attr.aria-disabled]="recs().loading || null"
              (click)="refresh()"
            >
              {{ recs().loading ? 'Refreshing…' : 'Refresh' }}
            </button>
          </div>
        </div>
        <p class="mt-applied">
          @if (r.status === 'PARTIAL') {
            <em class="partial-word">Partial:</em>
          }
          {{ appliedText(r) }}
        </p>
        <!-- A reason every match shares is said once here, not on every row. -->
        @if (sharedReasons().length) {
          <div class="mt-shared">
            <span class="mt-shared-label">Every match:</span>&ngsp;
            <gz-reasons
              [reasons]="sharedReasons()"
              [max]="sharedReasons().length"
              label="Why every match was suggested"
            />
          </div>
        }
        @if (recs().error && !recs().loading) {
          <div class="insight danger mt-alert" role="alert">
            <span>Matches could not refresh. These are the ones loaded before.</span>
            <button type="button" class="btn small" (click)="retryLoad()">Retry</button>
          </div>
        }
        <table
          gz-table
          class="mt-table"
          [sticky]="sticky()"
          [(sort)]="sort"
          (activated)="open($event)"
        >
          <caption class="sr-only">
            {{ heading() }}, best match first. Choose a row to open the property.
          </caption>
          <thead>
            <tr>
              <th gz-sort="rank" numeric first="asc" class="mt-rank">Rank</th>
              <th scope="col">Property</th>
              <th gz-sort="beds" numeric data-priority="2">Beds</th>
              <th gz-sort="area" numeric data-priority="2">Living area, sq ft</th>
              <th gz-sort="value" numeric>ZentraValue</th>
              @if (anyRowReasons()) {
                <th scope="col" data-priority="2" class="mt-why-head">
                  {{ sharedReasons().length ? 'Other reasons' : 'Reasons' }}
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (m of rows(); track m.property.id; let first = $first) {
              <tr [gz-row]="m.property.id">
                <td class="num">{{ m.rank }}</td>
                <td class="mt-prop">
                  <a class="cell-main" [routerLink]="['/property', m.property.id]">{{
                    title(m)
                  }}</a>
                  @if (place(m); as where) {
                    <span class="cell-sub">{{ where }}</span>
                  }
                  <span class="cell-sub m-only">{{ facts(m) }}</span>
                </td>
                <td
                  gz-cell
                  class="num"
                  data-priority="2"
                  [missing]="m.property.bedrooms == null"
                  reason="Not in the county record"
                >
                  {{ m.property.bedrooms }}
                </td>
                <td
                  gz-cell
                  class="num"
                  data-priority="2"
                  [missing]="m.property.livingAreaSqft == null"
                  reason="Not in the county record"
                >
                  {{ m.property.livingAreaSqft | number: '1.0-0' }}
                </td>
                @if (valuesError()) {
                  <!-- One reason for the whole column: one merged span (DESIGN.md §6). It sits in
                       the first row's markup but beside every row, so it takes no pointer (a click
                       or hover beside row 5 reaches row 5) and never opens the first row. -->
                  @if (first) {
                    <td
                      class="num na mt-values-na"
                      [attr.rowspan]="rows().length"
                      (click)="$event.stopPropagation()"
                    >
                      <span class="na-word">Unavailable</span>
                      <span class="na-why">ZentraValues could not load.</span>
                      <button type="button" class="btn small" (click)="retryValues()">Retry</button>
                    </td>
                  }
                } @else if (valuesLoading()) {
                  <td class="num">
                    <span class="skeleton mt-skel" aria-hidden="true"></span
                    ><span class="sr-only">Loading ZentraValue</span>
                  </td>
                } @else {
                  @let p = prediction(m.property.id);
                  <td
                    gz-cell
                    class="num nowrap"
                    [missing]="!p"
                    reason="No estimate was returned for this property"
                  >
                    @if (p) {
                      {{ p.predictedPrice | currency: 'USD' : 'symbol' : '1.0-0' }}
                      <span class="cell-sub" [class.attention]="isLow(p)">{{
                        confidence(p)
                      }}</span>
                    }
                  </td>
                }
                @if (anyRowReasons()) {
                  <td data-priority="2" class="mt-why">
                    @if (rowReasons(m); as own) {
                      @if (own.length) {
                        <gz-reasons [reasons]="own" [label]="'Why ' + title(m) + ' matched'" />
                      } @else {
                        <span class="muted">No other reason</span>
                      }
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
        @if (more(); as n) {
          <p class="mt-more">
            <a routerLink="/opportunities" [queryParams]="{ view: 'matches' }"
              >See all {{ n }} matches</a
            >
          </p>
        }
        <div class="mt-notes">
          @for (note of footnotes(); track note) {
            <p class="table-note">{{ note }}</p>
          }
          <p class="table-note">
            ZentraValue is GeoZentra’s estimate of market value, not an asking price.
          </p>
          @for (note of limitations(r); track note) {
            <p class="table-note">{{ note }}</p>
          }
        </div>
        <details class="mt-method">
          <summary>Method</summary>
          <gz-record-group>
            <div gz-record-row label="Ranking">{{ ranking(r) }}</div>
            <div gz-record-row label="Source" [missing]="!r.source" reason="Not sent with these matches">
              {{ source(r) }}
            </div>
            <div
              gz-record-row
              label="Records as of"
              [missing]="!asOf(r)"
              reason="The matching service doesn't say when its records were last updated"
            >
              {{ asOf(r) }}
            </div>
          </gz-record-group>
        </details>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    h2 {
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    /* Focused only by script, when a Retry removes itself (as on the overview's sections). */
    h2:focus {
      outline: none;
    }
    .mt-block,
    .mt {
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
    }
    /* On a page of its own (a tab), the section sits on the page like the other registers. */
    :host(.bare) .mt-block,
    :host(.bare) .mt {
      padding: 0;
      background: none;
      border-top: 0;
    }
    .mt-text {
      margin: var(--sp-4) 0 var(--sp-16);
      font-size: var(--fs-body);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .mt-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-8);
    }
    .mt-alert {
      margin: var(--sp-12) 0;
    }
    .mt-alert span {
      flex: 1;
      min-width: 0;
    }
    .mt-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--sp-12) var(--sp-16);
    }
    .mt-count {
      margin: 2px 0 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
    }
    .mt-applied {
      margin: var(--sp-12) 0 var(--sp-12);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      max-width: 90ch;
    }
    .mt-shared {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 var(--sp-8);
      margin: 0 0 var(--sp-12);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
    }
    .mt-shared-label {
      color: var(--ink-2);
    }
    .mt-rank {
      width: 1%;
    }
    .mt-prop {
      min-width: 168px;
      overflow-wrap: anywhere;
    }
    .mt-prop a {
      color: var(--ink);
    }
    .mt-prop a:hover {
      color: var(--copper);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .mt-why-head {
      width: 30%;
    }
    .mt-why {
      max-width: 320px;
    }
    .mt-skel {
      display: inline-block;
      width: 88px;
      height: 16px;
      vertical-align: middle;
    }
    .mt-values-na {
      vertical-align: middle;
      text-align: left;
      pointer-events: none;
    }
    .mt-values-na .btn {
      margin-top: var(--sp-8);
      pointer-events: auto;
    }
    /* Its rows' hover doesn't paint the span (it belongs to no single row). */
    .gz-table tbody tr:hover > td.mt-values-na {
      background-color: transparent;
    }
    .mt-more {
      margin: var(--sp-12) 0 0;
      font-size: var(--fs-cell);
    }
    .mt-more a {
      color: var(--copper);
      font-weight: 500;
    }
    .mt-more a:hover {
      color: var(--copper-hover);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .mt-notes {
      margin-top: var(--sp-8);
    }
    .mt-method {
      margin-top: var(--sp-16);
      font-size: var(--fs-cell);
    }
    .mt-method summary {
      cursor: pointer;
      color: var(--copper);
      font-weight: 500;
    }
    .mt-method gz-record-group {
      max-width: 560px;
    }
    @media (max-width: 700px) {
      .mt-block,
      .mt {
        padding: var(--sp-12) var(--sp-16) var(--sp-16);
      }
      .mt-buttons .btn {
        flex: 1 1 auto;
      }
      :host(.bare) .mt-block,
      :host(.bare) .mt {
        padding: 0;
      }
      /* The confidence may wrap under the figure; the rank keeps to its digits. */
      .mt-table td.nowrap {
        white-space: normal;
      }
      .mt-table .mt-rank,
      .mt-table td:first-child {
        padding-left: 4px;
        padding-right: 4px;
      }
    }
  `,
})
export class Matches {
  /** How many suggestions to ask for; the page and the overview ask for the same list. */
  readonly requestLimit = input(20);
  /** Rows shown; null shows every suggestion. A smaller number adds "See all N matches". */
  readonly limit = input<number | null>(null);
  readonly heading = input('Matches for your search');
  /** The table header sticks under the top bar on a page; not inside a card. */
  readonly sticky = input<'page' | 'local' | 'none'>('page');
  /**
   * A white section under a 2 px ink rule (the overview's lead element). False on a page of its
   * own, where the table sits on the page like the other registers.
   */
  readonly framed = input(true);
  /** Ids for the headings, unique per instance (the overview and a page may both show one). */
  readonly id = 'gz-matches-' + nextId++;

  readonly w = inject(Workspace);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly recs = this.w.store.selectSignal(selectRecommendations);
  private readonly valuation = this.w.store.selectSignal(selectValuation);
  readonly skeletonRows = [0, 1, 2, 3, 4];

  /** Client-side, within the loaded suggestions (DESIGN.md §7); null keeps the backend's rank. */
  readonly sort = signal<Sort | null>(null);
  private readonly items = computed(() => {
    const r = this.recs().response;
    if (!r || (r.status !== 'READY' && r.status !== 'PARTIAL')) return [];
    const limit = this.limit();
    return limit === null ? r.content : r.content.slice(0, limit);
  });
  readonly rows = computed(() =>
    sortRows(this.items(), this.sort(), (m, key) => {
      if (key === 'beds') return m.property.bedrooms;
      if (key === 'area') return m.property.livingAreaSqft;
      if (key === 'value') return this.prediction(m.property.id)?.predictedPrice ?? null;
      return m.rank;
    }),
  );
  /**
   * Reasons every loaded match has (the same county reason on all 8, say): said once above the
   * table. Taken over every loaded match, so it stays true when the overview shows the top 5.
   */
  readonly sharedReasons = computed(() => {
    const r = this.recs().response;
    const all = r && (r.status === 'READY' || r.status === 'PARTIAL') ? r.content : [];
    if (all.length < 2) return [];
    const [first, ...rest] = all.map((m) => this.reasons(m));
    return first.filter((reason) => rest.every((own) => own.includes(reason)));
  });
  /** A Reasons column only when some row has a reason of its own. */
  readonly anyRowReasons = computed(() => this.items().some((m) => this.rowReasons(m).length > 0));
  readonly more = computed(() => {
    const total = this.recs().response?.content.length ?? 0;
    return this.items().length < total ? total : null;
  });
  readonly valuesLoading = computed(() => this.valuation().bulkLoading);
  readonly valuesError = computed(() => !!this.valuation().bulkError && !this.valuesLoading());

  readonly footnotes = computed(() => {
    const rows = this.items();
    const notes: string[] = [];
    const facts = [
      rows.some((m) => m.property.bedrooms == null) && 'beds',
      rows.some((m) => m.property.livingAreaSqft == null) && 'living area',
    ].filter(Boolean);
    if (facts.length) notes.push(`Unavailable ${facts.join(' and ')}: not in the county record.`);
    if (!this.valuesLoading() && !this.valuesError() && rows.some((m) => !this.prediction(m.property.id)))
      notes.push(
        rows.filter((m) => !this.prediction(m.property.id)).length === 1
          ? 'Unavailable ZentraValue: no estimate was returned for that property.'
          : 'Unavailable ZentraValue: no estimate was returned for those properties.',
      );
    const s = this.sort();
    if (s && !(s.key === 'rank' && s.dir === 'asc'))
      notes.push(
        `Sorted within these ${countOf(rows.length, 'match', 'matches')}; the rank is the order they were suggested in.`,
      );
    return notes;
  });

  signedIn() {
    return this.w.auth.isLoggedIn();
  }
  /** Refetching: the previous render stays at 60% opacity (DESIGN.md §6). */
  busy() {
    return this.recs().loading ? 'true' : null;
  }

  private valuesKey = '';
  /** A Retry removed itself: focus waits on the heading until the section shows the answer. */
  private refocus = false;
  constructor() {
    // Suggestions when signed in and none are held: on arrival, and again after the preferences
    // are saved (the slice drops its answer and any error then). A failed load waits for Retry.
    effect(() => {
      const s = this.recs();
      if (s.response || s.loading || s.error || !this.signedIn()) return;
      untracked(() => this.load());
    });
    // After a Retry, the answer may replace the section (skeleton → table): its new heading takes
    // the focus, unless the user has moved it somewhere else meanwhile.
    effect(() => {
      if (this.recs().loading || !this.refocus) return;
      this.refocus = false;
      afterNextRender(
        () => {
          const active = document.activeElement;
          if (active && active !== document.body) return;
          this.headingEl()?.focus();
        },
        { injector: this.injector },
      );
    });
    // ZentraValues for the rows, once per set of rows, unless the valuation slice already holds
    // every one of them (coming back to the tab). A row without an estimate can't be told from one
    // never asked for, so a set with such a row is asked for again. The slice keeps one bulk
    // request's status, whichever page asked last: while another page's request runs or after it
    // failed, ask anyway, so the loading and failure shown here are this request's.
    effect(() => {
      const ids = this.items().map((m) => m.property.id);
      const key = ids.join(',');
      if (!ids.length) {
        this.valuesKey = '';
        return;
      }
      if (key === this.valuesKey) return;
      this.valuesKey = key;
      untracked(() => {
        const v = this.valuation();
        if (!v.bulkLoading && !v.bulkError && ids.every((id) => v.predictions[id])) return;
        this.w.store.dispatch(ValuationActions.loadBulk({ propertyIds: ids }));
      });
    });
  }

  load() {
    if (this.w.requireAccount('see your matches'))
      this.w.store.dispatch(RecommendationsActions.load({ limit: this.requestLimit() }));
  }
  /** Retry removes itself when pressed: focus moves to the section heading first. */
  retryLoad() {
    this.headingEl()?.focus();
    this.refocus = true;
    this.load();
  }
  refresh() {
    if (!this.recs().loading) this.load();
  }
  /** The section's heading (the area form's, while it shows). */
  private headingEl() {
    return this.host.nativeElement.querySelector<HTMLElement>('h2');
  }
  retryValues() {
    // The merged span and its Retry give way to the loading cells.
    this.headingEl()?.focus();
    const ids = this.items().map((m) => m.property.id);
    this.valuesKey = ids.join(',');
    if (ids.length) this.w.store.dispatch(ValuationActions.loadBulk({ propertyIds: ids }));
  }
  open(id: unknown) {
    void this.router.navigate(['/property', id]);
  }

  prediction(id: number): PropertyValuePrediction | null {
    return this.valuation().predictions[id] ?? null;
  }
  /** One format everywhere (DESIGN.md §9): "Confidence 70 of 100 · Medium". */
  confidence(p: PropertyValuePrediction) {
    return formatConfidence(p.confidenceScore, p.confidence);
  }
  isLow(p: PropertyValuePrediction) {
    return isLowConfidence(p.confidence);
  }
  title(m: RecommendationItem) {
    const folio = formatFolio(m.property.folio);
    return m.property.address || (folio ? 'Folio ' + folio : 'Address unavailable');
  }
  place(m: RecommendationItem) {
    const p = m.property;
    return placeLine(p.city || p.countyName, p.stateCode, p.zip);
  }
  /** The phone's second line, where Beds and Living area have no column. */
  facts(m: RecommendationItem) {
    const p = m.property;
    const beds = p.bedrooms == null ? 'Beds unavailable' : countOf(p.bedrooms, 'bed');
    const area =
      p.livingAreaSqft == null
        ? 'living area unavailable'
        : p.livingAreaSqft.toLocaleString('en-US') + ' sq ft';
    return joinParts(' · ', beds, area);
  }
  /** A row's reasons beyond the ones every match shares. */
  rowReasons(m: RecommendationItem) {
    const shared = this.sharedReasons();
    return this.reasons(m).filter((r) => !shared.includes(r));
  }
  /** The backend's limitations, with field names in plain words (DESIGN.md §13). */
  limitations(r: RecommendationResponse) {
    return plainNotes(r.limitations);
  }
  /** The backend's reasons as sent, plus any budget or goal check that says something per row. */
  reasons(m: RecommendationItem) {
    const extra = [
      m.budgetMatch && !SILENT_MATCH.has(m.budgetMatch) ? 'Budget: ' + labelFor(m.budgetMatch) : null,
      m.goalMatch && !SILENT_MATCH.has(m.goalMatch) ? 'Goals: ' + labelFor(m.goalMatch) : null,
    ].filter((x): x is string => !!x);
    return [...m.reasons, ...extra];
  }

  /** The counties the backend applied, by name from the saved preferences. */
  private counties(r: RecommendationResponse) {
    const saved = this.w.account().preferences?.targetLocations ?? [];
    const names = r.appliedCountyIds.map((id) => {
      const c = saved.find((x) => x.countyId === id);
      return c?.countyName ? joinParts(', ', c.countyName, c.stateCode) : null;
    });
    const n = r.appliedCountyIds.length;
    const noun = n === 1 ? 'your target county' : 'your target counties';
    return names.every((x) => x !== null) && n > 0
      ? { noun, names: listOf(names as string[]) }
      : { noun: n ? countOf(n, 'target county', 'target counties') : 'your target counties', names: '' };
  }
  countText(r: RecommendationResponse) {
    const shown = this.items().length;
    return shown < r.content.length
      ? `Top ${shown} of ${r.content.length} properties`
      : countOf(r.content.length, 'property', 'properties');
  }
  /** generatedAt is an instant: the viewer's own day, not the UTC one. */
  updated(r: RecommendationResponse) {
    return formatLocalDate(r.generatedAt);
  }
  appliedText(r: RecommendationResponse) {
    const c = this.counties(r);
    if (r.status !== 'PARTIAL')
      return c.names ? `Matched on ${c.noun}: ${c.names}.` : `Matched on ${c.noun}.`;
    const budget = r.minBudget !== null || r.maxBudget !== null;
    const goals = r.investmentGoals.length > 0;
    const skipped =
      budget && goals
        ? 'Your budget and goals were not applied.'
        : budget
          ? 'Your budget was not applied.'
          : goals
            ? 'Your goals were not applied.'
            : 'Some of your preferences were not applied.';
    return (c.names ? `matched on ${c.noun} only (${c.names}). ` : `matched on ${c.noun} only. `) + skipped;
  }
  noMatchText(r: RecommendationResponse) {
    const c = this.counties(r);
    return c.names
      ? `No property records were found in ${c.noun}: ${c.names}.`
      : `No property records were found in ${c.noun}.`;
  }
  ranking(r: RecommendationResponse) {
    return r.rankingMethod ? (RANKING[r.rankingMethod] ?? r.rankingMethod) : 'Not stated';
  }
  source(r: RecommendationResponse) {
    return labelFor(r.source);
  }
  asOf(r: RecommendationResponse) {
    return formatLocalDate(r.sourceAsOf);
  }
}
