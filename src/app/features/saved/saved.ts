import {
  Component,
  DestroyRef,
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { Desk } from '../../shared/layout/desk';
import { RecordPane } from '../../shared/layout/record-pane';
import { Sort, TABLE_KIT, sortRows } from '../../shared/table';
import {
  countOf,
  formatConfidence,
  formatLocalDate,
  isLowConfidence,
  placeLine,
} from '../../shared/data/format';
import { PropertySearchItem, SavedSearchDTO } from '../../core/models/api';
import { PropertyValuePrediction } from '../../core/models/property_prediction_value';
import { favoritesActions as F } from '../../store/favorites/favorites.actions';
import { savedSearchesActions as A } from '../../store/saved-searches/saved-searches.actions';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import { LocationsActions } from '../../store/locations/locations.actions';
import { ValuationActions } from '../../store/valuation/valuation.actions';
import { selectValuation } from '../../store/valuation/valuation.selectors';
import { selectLocations } from '../../store/locations/locations.selectors';
import { SavedSearchRecord } from './saved-search-record';
import { searchWords } from './search-words';

type View = 'properties' | 'searches';
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** One saved property, with its record when the details have loaded. */
interface SavedRow {
  id: number;
  savedAt: string;
  home: PropertySearchItem | undefined;
}

/**
 * Saved (DESIGN.md §5 Register, §7): what the account has kept, as two tables behind tabs kept in
 * the address (?view=searches).
 * - Properties: the saved homes with their facts and ZentraValue (the existing bulk prediction
 *   action, once per set of rows); a row opens the property's page; Remove unsaves it.
 * - Searches: the saved searches (server pages of 20); a row opens the search in the record pane,
 *   with what it matches, how it is checked and its matches today.
 */
@Component({
  imports: [
    RouterLink,
    PageHeading,
    RequestStatus,
    Desk,
    RecordPane,
    SavedSearchRecord,
    ...TABLE_KIT,
  ],
  template: `<gz-desk [open]="paneSearch() !== null" [label]="paneLabel()" (closed)="closePane()">
      <gz-heading title="Saved" subtitle="The properties and searches you keep, and how each search is checked." />
      @if (!w.auth.isLoggedIn()) {
        <section class="sv-guest" aria-labelledby="sv-guest-title">
          <h2 id="sv-guest-title">Sign in to keep a shortlist</h2>
          <p class="sv-text">Saved properties and searches stay with your account across visits and devices.</p>
          <div class="sv-buttons">
            <button type="button" class="btn primary" (click)="w.signIn()">Sign in</button>
            <button type="button" class="btn" (click)="w.signUp()">Create account</button>
          </div>
        </section>
      } @else {
        <div class="tabs" role="tablist" aria-label="Saved">
          @for (t of tabs; track t[0]) {
            <button
              type="button"
              role="tab"
              [id]="'sv-tab-' + t[0]"
              [attr.aria-selected]="view() === t[0]"
              aria-controls="sv-panel"
              [attr.tabindex]="view() === t[0] ? 0 : -1"
              [class.active]="view() === t[0]"
              (click)="show(t[0])"
              (keydown)="onTabKey($event)"
            >
              {{ t[1] }}
              @if (tabCount(t[0]); as c) {
                <span class="sv-count">{{ c }}</span>
              }
            </button>
          }
        </div>
        <div role="tabpanel" id="sv-panel" [attr.aria-labelledby]="'sv-tab-' + view()">
          @if (view() === 'properties') {
            <gz-request-status
              [loading]="w.favoriteState().loading && !rows().length"
              loadingText="Loading your saved properties…"
              [error]="w.favoriteState().error"
              (retry)="loadFavorites()"
            />
            @if (rows().length) {
              <table gz-table class="sv-table" [(sort)]="sort" (activated)="openProperty($event)">
                <caption class="sr-only">Saved properties. Choose a row to open its record.</caption>
                <thead>
                  <tr>
                    <th scope="col">Property</th>
                    <th gz-sort="beds" numeric data-priority="2">Beds</th>
                    <th gz-sort="area" numeric data-priority="2">Living area, sq ft</th>
                    <th gz-sort="built" numeric data-priority="3">Built</th>
                    <th gz-sort="value" numeric>ZentraValue</th>
                    <th gz-sort="saved" numeric data-priority="2">Saved</th>
                    <th scope="col" data-priority="2"><span class="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of sortedRows(); track r.id; let first = $first) {
                    @if (r.home; as h) {
                      <tr [gz-row]="r.id">
                        <td class="sv-prop">
                          <a class="cell-main" [routerLink]="['/property', r.id]">{{ title(h) }}</a>
                          <span class="cell-sub">{{ place(h) }}</span>
                          <span class="cell-sub m-only">{{ facts(h) }}</span>
                          <button type="button" class="linkbtn m-only sv-remove-m"
                            [attr.aria-disabled]="pending(r.id) ? 'true' : null"
                            [attr.aria-label]="(pending(r.id) ? 'Removing ' : 'Remove ') + title(h) + ' from saved'"
                            (click)="$event.stopPropagation(); remove(r.id)">
                            {{ pending(r.id) ? 'Removing…' : 'Remove' }}
                          </button>
                        </td>
                        <td gz-cell class="num" data-priority="2" [missing]="h.bedrooms == null" reason="Not in the county record">
                          {{ h.bedrooms }}
                        </td>
                        <td gz-cell class="num" data-priority="2" [missing]="h.livingAreaSqft == null" reason="Not in the county record">
                          {{ h.livingAreaSqft?.toLocaleString('en-US') }}
                        </td>
                        <td gz-cell class="num" data-priority="3" [missing]="!h.yearBuilt" reason="Not in the county record">
                          {{ h.yearBuilt }}
                        </td>
                        @if (valuesError()) {
                          @if (first) {
                            <!-- One reason for the column: one merged span (DESIGN.md §6). -->
                            <td class="num na sv-values-na" [attr.rowspan]="sortedRows().length" (click)="$event.stopPropagation()">
                              <span class="na-word">Unavailable</span>
                              <span class="na-why">ZentraValues could not load.</span>
                              <button type="button" class="btn small" (click)="retryValues()">Retry</button>
                            </td>
                          }
                        } @else if (valuesLoading()) {
                          <td class="num"><span class="skeleton sv-skel" aria-hidden="true"></span><span class="sr-only">Loading ZentraValue</span></td>
                        } @else {
                          @let p = prediction(r.id);
                          <td gz-cell class="num nowrap" [missing]="!p" reason="No estimate was returned for this property">
                            @if (p) {
                              {{ money(p.predictedPrice) }}
                              <span class="cell-sub" [class.attention]="low(p)">{{ confidence(p) }}</span>
                            }
                          </td>
                        }
                        <td class="num" data-priority="2">{{ day(r.savedAt) }}</td>
                        <td class="sv-remove" data-priority="2">
                          <button type="button" class="btn small"
                            [attr.aria-disabled]="pending(r.id) ? 'true' : null"
                            [attr.aria-label]="(pending(r.id) ? 'Removing ' : 'Remove ') + title(h) + ' from saved'"
                            (click)="$event.stopPropagation(); remove(r.id)">
                            {{ pending(r.id) ? 'Removing…' : 'Remove' }}
                          </button>
                        </td>
                      </tr>
                    } @else {
                      <tr>
                        <td class="sv-prop">
                          <a class="cell-main" [routerLink]="['/property', r.id]">Open the record</a>
                          @if (detailsPending(r.id)) {
                            <span class="cell-sub">Loading its details…</span>
                          } @else {
                            <span class="cell-sub">Its details could not load.</span>
                            <button type="button" class="btn small sv-retry" (click)="loadProperty(r.id)">Retry</button>
                          }
                          <button type="button" class="linkbtn m-only sv-remove-m"
                            [attr.aria-disabled]="pending(r.id) ? 'true' : null"
                            [attr.aria-label]="pending(r.id) ? 'Removing this property from saved…' : 'Remove this property from saved'"
                            (click)="remove(r.id)">{{ pending(r.id) ? 'Removing…' : 'Remove' }}</button>
                        </td>
                        <td class="na" colspan="3" data-priority="2">
                          <span class="na-word">Unavailable</span>
                          <span class="sr-only">: the property's details have not loaded</span>
                        </td>
                        @if (valuesError()) {
                          @if (first) {
                            <!-- One reason for the column: one merged span (DESIGN.md §6). -->
                            <td class="num na sv-values-na" [attr.rowspan]="sortedRows().length" (click)="$event.stopPropagation()">
                              <span class="na-word">Unavailable</span>
                              <span class="na-why">ZentraValues could not load.</span>
                              <button type="button" class="btn small" (click)="retryValues()">Retry</button>
                            </td>
                          }
                        } @else {
                          <td class="num na">
                            <span class="na-word">Unavailable</span>
                            <span class="sr-only">: asked for once its details load</span>
                          </td>
                        }
                        <td class="num" data-priority="2">{{ day(r.savedAt) }}</td>
                        <td class="sv-remove" data-priority="2">
                          <button type="button" class="btn small" [attr.aria-disabled]="pending(r.id) ? 'true' : null"
                            [attr.aria-label]="pending(r.id) ? 'Removing this property from saved…' : 'Remove this property from saved'"
                            (click)="remove(r.id)">{{ pending(r.id) ? 'Removing…' : 'Remove' }}</button>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
              <div class="sv-notes">
                @if (notes(); as list) {
                  @for (note of list; track note) {
                    <p class="table-note">{{ note }}</p>
                  }
                }
                <p class="table-note">ZentraValue is GeoZentra’s estimate of market value, not an asking price.</p>
              </div>
            } @else if (!w.favoriteState().loading && !w.favoriteState().error) {
              <p class="sv-text">Properties you save from Explore or a property page appear here.</p>
              <a class="btn primary" routerLink="/explore">Explore properties</a>
            }
          } @else {
            <gz-request-status
              [loading]="w.searchState().loading && !searches().length"
              loadingText="Loading your saved searches…"
              [error]="w.searchState().errorOperation === 'load' ? w.searchState().error : null"
              (retry)="page(w.searchState().page)"
            />
            @if (w.searchState().errorOperation === 'save' && w.searchState().error; as error) {
              <p class="field-error" role="alert">{{ error }}</p>
            }
            @if (searches().length) {
              <p class="sv-count-line" #searchCount tabindex="-1">{{ searchCountText() }}</p>
              <table
                gz-table
                class="sv-table"
                [(selected)]="selectedId"
                (activated)="openSearch($event)"
                (dismissed)="closePane()"
                [paneOpen]="paneSearch() !== null"
                [attr.aria-busy]="w.searchState().loading ? 'true' : null"
              >
                <caption class="sr-only">Saved searches. Choose a row to see what it matches and how it is checked.</caption>
                <thead>
                  <tr>
                    <th scope="col">Search</th>
                    <th scope="col" data-priority="2">Checked</th>
                    <th scope="col">Status</th>
                    <th scope="col" class="num" data-priority="3">Saved</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of searches(); track s.id) {
                    <tr [gz-row]="s.id">
                      <td>
                        <span class="cell-main">{{ s.name }}</span>
                        <span class="cell-sub">{{ wordsOf(s) }}</span>
                      </td>
                      <td data-priority="2">{{ s.cadence === 'WEEKLY' ? 'Weekly' : 'Daily' }}</td>
                      <td>{{ s.paused ? 'Paused' : 'Active' }}</td>
                      <td class="num" data-priority="3">{{ day(s.createdAt) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <gz-pager
                [page]="w.searchState().page"
                [size]="20"
                [total]="w.searchState().totalElements"
                [loading]="w.searchState().loading"
                (changed)="page($event)"
              />
            } @else if (!w.searchState().loading && !w.searchState().error) {
              <p class="sv-text">Searches you save in Explore appear here; each can be checked daily or weekly for new matches.</p>
              <a class="btn primary" routerLink="/explore">Explore properties</a>
            }
          }
        </div>
      }
      @if (paneSearch(); as s) {
        <gz-record-pane
          deskSlot
          [heading]="s.name"
          noun="saved search"
          backLabel="Saved searches"
          [position]="position()"
          [hasPrev]="paneIndex() > 0"
          [hasNext]="paneIndex() < searches().length - 1"
          (prev)="step(-1)"
          (next)="step(1)"
          (closed)="closePane()"
        >
          <span paneMeta>{{ s.paused ? 'Paused' : 'Checked ' + (s.cadence === 'WEEKLY' ? 'weekly' : 'daily') }}</span>
          <div paneActions class="sv-pane-actions">
            <button type="button" class="btn primary" (click)="openInExplore(s)">Open in Explore</button>
            <button type="button" class="btn" [attr.aria-disabled]="w.searchState().saving ? 'true' : null"
              [attr.aria-describedby]="w.searchState().saving ? 'sv-saving' : null"
              (click)="removeSearch(s)">Delete</button>
            @if (w.searchState().saving) {
              <p class="sv-why" id="sv-saving">Saving a change to your searches…</p>
            }
            <span class="sr-only" role="status">{{ w.searchState().saving ? 'Saving a change to your searches…' : '' }}</span>
          </div>
          <gz-saved-search-record [search]="s" [countyName]="countyName(s.filters.countyId)" />
        </gz-record-pane>
      }
    </gz-desk>`,
  styles: `
    .sv-guest {
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
      max-width: 720px;
    }
    .sv-guest h2 {
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    .sv-text {
      margin: var(--sp-8) 0 var(--sp-16);
      font-size: var(--fs-body);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .sv-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-8);
    }
    .tabs {
      margin-bottom: var(--sp-16);
    }
    .sv-count {
      margin-left: 6px;
      color: var(--ink-2);
      font-variant-numeric: tabular-nums;
    }
    .sv-count-line {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-cell);
      color: var(--ink-2);
      outline: none;
      scroll-margin-top: calc(var(--topbar-h) + var(--sp-8));
    }
    #sv-panel:focus {
      outline: none;
    }
    .sv-prop {
      min-width: 180px;
      overflow-wrap: anywhere;
    }
    .sv-prop a {
      color: var(--ink);
    }
    .sv-prop a:hover {
      color: var(--copper);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .sv-remove-m {
      margin-top: var(--sp-4);
      align-self: flex-start;
    }
    .sv-retry {
      margin-top: var(--sp-4);
    }
    .sv-remove {
      width: 1%;
      text-align: right;
      white-space: nowrap;
    }
    .sv-skel {
      display: inline-block;
      width: 88px;
      height: 16px;
      vertical-align: middle;
    }
    .sv-values-na {
      vertical-align: middle;
      text-align: left;
      pointer-events: none;
    }
    .sv-values-na .btn {
      margin-top: var(--sp-8);
      pointer-events: auto;
    }
    .gz-table tbody tr:hover > td.sv-values-na {
      background-color: transparent;
    }
    .sv-notes {
      margin-top: var(--sp-8);
    }
    .sv-pane-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8);
    }
    .sv-why {
      flex-basis: 100%;
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
  `,
})
export class Saved {
  readonly w = inject(Workspace);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly valuation = this.w.store.selectSignal(selectValuation);
  private readonly locations = this.w.store.selectSignal(selectLocations);
  private readonly searchCount = viewChild<ElementRef<HTMLElement>>('searchCount');

  readonly tabs: [View, string][] = [
    ['properties', 'Properties'],
    ['searches', 'Searches'],
  ];
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  /** ?view=searches opens Searches; the tab follows the address. */
  readonly view = linkedSignal<View>(() =>
    this.query().get('view') === 'searches' ? 'searches' : 'properties',
  );

  // Saved properties: every favourite the account holds, newest first until a column is sorted.
  readonly rows = computed<SavedRow[]>(() =>
    [...this.w.favorites()]
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .map((f) => ({ id: f.propertyId, savedAt: f.createdAt, home: this.w.home(f.propertyId) })),
  );
  readonly sort = signal<Sort | null>(null);
  readonly sortedRows = computed(() =>
    sortRows(this.rows(), this.sort(), (r, key) => {
      const h = r.home;
      if (key === 'beds') return h?.bedrooms ?? null;
      if (key === 'area') return h?.livingAreaSqft ?? null;
      if (key === 'built') return h?.yearBuilt ? Number(h.yearBuilt) : null;
      if (key === 'value') return this.prediction(r.id)?.predictedPrice ?? null;
      return r.savedAt || null;
    }),
  );
  readonly valuesLoading = computed(() => this.valuation().bulkLoading);
  readonly valuesError = computed(() => !!this.valuation().bulkError && !this.valuesLoading());
  readonly notes = computed(() => {
    const rows = this.rows().filter((r) => r.home);
    const out: string[] = [];
    if (rows.some((r) => r.home!.bedrooms == null || r.home!.livingAreaSqft == null || !r.home!.yearBuilt))
      out.push('Unavailable facts: not in the county record.');
    const noValue = rows.filter((r) => !this.prediction(r.id)).length;
    if (!this.valuesLoading() && !this.valuesError() && noValue)
      out.push(
        noValue === 1
          ? 'Unavailable ZentraValue: no estimate was returned for that property.'
          : 'Unavailable ZentraValue: no estimate was returned for those properties.',
      );
    if (this.sort()) out.push(`Sorted within your ${countOf(this.rows().length, 'saved property', 'saved properties')}.`);
    return out;
  });

  // Saved searches: the page the slice holds.
  readonly searches = this.w.searches;
  readonly selectedId = signal<unknown>(null);
  private readonly paneOpen = signal(false);
  readonly paneIndex = computed(() => this.searches().findIndex((s) => s.id === this.selectedId()));
  readonly paneSearch = computed(() =>
    this.paneOpen() && this.view() === 'searches' ? (this.searches()[this.paneIndex()] ?? null) : null,
  );
  readonly paneLabel = computed(() => 'Saved search: ' + (this.paneSearch()?.name ?? ''));
  readonly position = computed(() =>
    this.paneIndex() < 0 ? '' : `${this.paneIndex() + 1} of ${this.searches().length} on this page`,
  );
  readonly searchCountText = computed(() => {
    const st = this.w.searchState();
    return countOf(st.totalElements, 'saved search', 'saved searches');
  });

  private valuesKey = '';
  private focusCount = false;
  constructor() {
    // The account's saved items, fresh on every visit (as before), once signed in.
    effect(() => {
      if (!this.w.auth.isLoggedIn()) return;
      untracked(() => {
        this.loadFavorites();
        this.w.store.dispatch(A.load({ page: 0 }));
      });
    });
    // ZentraValues for the saved properties, once per set; asked again while another page's bulk
    // request runs or after it failed, so the state shown is this request's (as in gz-matches).
    effect(() => {
      const fav = this.w.favoriteState();
      if (fav.loading || fav.detailsPending.length) return;
      const ids = this.rows().filter((r) => r.home).map((r) => r.id);
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
    // A search that left the page (deleted, or another page) closes its pane.
    effect(() => {
      if (this.paneOpen() && this.paneIndex() < 0) untracked(() => this.paneOpen.set(false));
    });
    // After paging, the list starts from its count, which takes focus (DESIGN.md §7 paging).
    effect(() => {
      if (this.w.searchState().loading || !this.focusCount) return;
      this.focusCount = false;
      untracked(() => {
        const el = this.searchCount()?.nativeElement;
        el?.scrollIntoView?.({ block: 'start' });
        el?.focus({ preventScroll: true });
      });
    });
  }

  tabCount(v: View) {
    if (v === 'properties') {
      const fav = this.w.favoriteState();
      return fav.loaded && !fav.error ? String(this.rows().length) : '';
    }
    const st = this.w.searchState();
    if (!this.searches().length && (st.loading || (st.error && st.errorOperation === 'load'))) return '';
    return String(st.totalElements);
  }
  show(view: View) {
    if (view === this.view()) return;
    this.view.set(view);
    if (view !== 'searches') this.paneOpen.set(false);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'searches' ? 'searches' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  onTabKey(event: KeyboardEvent) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next: View =
      event.key === 'Home' ? 'properties' : event.key === 'End' ? 'searches' : this.view() === 'properties' ? 'searches' : 'properties';
    this.show(next);
    document.getElementById('sv-tab-' + next)?.focus();
  }

  loadFavorites() {
    this.w.store.dispatch(F.load());
  }
  loadProperty(propertyId: number) {
    if (!this.w.favoriteState().detailsPending.includes(propertyId))
      this.w.store.dispatch(F.loadProperty({ propertyId }));
  }
  detailsPending(id: number) {
    return this.w.favoriteState().detailsPending.includes(id);
  }
  pending(id: number) {
    return this.w.favoriteState().pending.includes(id);
  }
  openProperty(id: unknown) {
    void this.router.navigate(['/property', id]);
  }
  /** Unsaves the property; its row goes, so focus moves to the tab first. */
  remove(id: number) {
    if (this.pending(id)) return;
    document.getElementById('sv-tab-properties')?.focus();
    this.w.toggleSave(id);
  }
  retryValues() {
    const ids = this.rows().filter((r) => r.home).map((r) => r.id);
    this.valuesKey = ids.join(',');
    if (ids.length) this.w.store.dispatch(ValuationActions.loadBulk({ propertyIds: ids }));
  }

  page(page: number) {
    this.focusCount = page !== this.w.searchState().page;
    this.w.store.dispatch(A.load({ page }));
  }
  openSearch(id: unknown) {
    this.selectedId.set(id);
    this.paneOpen.set(true);
  }
  closePane() {
    if (!this.paneOpen()) return;
    this.paneOpen.set(false);
    afterNextRender(
      () => document.querySelector<HTMLElement>('.sv-table tr.gz-row.sel')?.focus({ preventScroll: false }),
      { injector: this.injector },
    );
  }
  step(by: number) {
    const next = this.searches()[this.paneIndex() + by];
    if (next) this.selectedId.set(next.id);
  }
  openInExplore(s: SavedSearchDTO) {
    // The backend stores filters in lower case ("fl"); the state goes back to its code. Explore's
    // state picker then follows the search (a different state may be chosen there now).
    const filters = { ...s.filters, ...(s.filters.state ? { state: s.filters.state.toUpperCase() } : {}) };
    this.w.store.dispatch(LocationsActions.selectState({ stateId: null }));
    this.w.store.dispatch(CatalogActions.search({ query: { ...filters, page: 0, size: 20 } }));
    void this.router.navigate(['/explore']);
  }
  async removeSearch(s: SavedSearchDTO) {
    if (this.w.searchState().saving) return;
    if (
      (await this.confirmation.confirm({
        title: 'Delete saved search?',
        message: `Delete "${s.name}" and the alerts that watch it? This can’t be undone.`,
      })) &&
      !this.destroy.destroyed &&
      !this.w.searchState().saving
    ) {
      // The pane and its row go: focus moves to the Searches tab once the register is back.
      this.paneOpen.set(false);
      afterNextRender(() => document.getElementById('sv-tab-searches')?.focus(), { injector: this.injector });
      this.w.store.dispatch(A.remove({ id: s.id }));
    }
  }

  prediction(id: number): PropertyValuePrediction | null {
    return this.valuation().predictions[id] ?? null;
  }
  confidence(p: PropertyValuePrediction) {
    return formatConfidence(p.confidenceScore, p.confidence);
  }
  low(p: PropertyValuePrediction) {
    return isLowConfidence(p.confidence);
  }
  money(v: number | null) {
    return v === null ? null : usd.format(v);
  }
  title(h: PropertySearchItem) {
    return h.address || 'Folio ' + h.folio;
  }
  place(h: PropertySearchItem) {
    return placeLine(h.city || h.countyName, h.stateCode, h.zip);
  }
  /** The phone's second line, where Beds and Living area have no column. */
  facts(h: PropertySearchItem) {
    const beds = h.bedrooms == null ? 'Beds unavailable' : countOf(h.bedrooms, 'bed');
    const area = h.livingAreaSqft == null ? 'living area unavailable' : h.livingAreaSqft.toLocaleString('en-US') + ' sq ft';
    return `${beds} · ${area}`;
  }
  day(v: string | null | undefined) {
    return formatLocalDate(v);
  }
  countyName(id: number | undefined) {
    if (id === undefined || id === null) return null;
    const loc = this.locations();
    const all = [...loc.counties, ...Object.values(loc.countiesByState ?? {}).flatMap((v) => v.counties)];
    return all.find((c) => c.countyId === id)?.countyName ?? null;
  }
  wordsOf(s: SavedSearchDTO) {
    const words = searchWords(s.filters, this.countyName(s.filters.countyId));
    return words.length ? words.join(' · ') : 'Every property';
  }
}
