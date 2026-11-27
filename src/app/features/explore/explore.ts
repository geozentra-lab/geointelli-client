import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PropertySearchRequest } from '../../core/models/api';
import { StateDTO } from '../../core/models/location';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import { LocationsActions } from '../../store/locations/locations.actions';
import { selectLocations } from '../../store/locations/locations.selectors';
import { savedSearchesActions } from '../../store/saved-searches/saved-searches.actions';
import { ValuationActions } from '../../store/valuation/valuation.actions';
import { selectValuation } from '../../store/valuation/valuation.selectors';
import { ExploreMapActions } from '../../store/explore-map/explore-map.actions';
import { Workspace } from '../../shared/data/workspace';
import { countOf, joinParts } from '../../shared/data/format';
import { CountyPicker } from '../../shared/components/county-picker';
import { RequestStatus } from '../../shared/components/request-status';
import { SignInPrompt } from '../../shared/components/sign-in-prompt';
import { Icon } from '../../shared/components/icon/icon';
import { Pager } from '../../shared/table/pager';
import { ExploreCard } from './explore-card';
// The map component (and Leaflet) must only be referenced inside @defer, or it loads with the page.
import { ExploreMap } from './explore-map';
import { rowTitle } from './explore-row';

type SortKey = NonNullable<PropertySearchRequest['sortBy']>;
/** Sorts the search API offers (sortBy and direction); unknown values come last either way. */
export const SORTS: { value: string; label: string }[] = [
  { value: 'id|asc', label: 'Record order' },
  { value: 'livingAreaSqft|desc', label: 'Living area, largest first' },
  { value: 'livingAreaSqft|asc', label: 'Living area, smallest first' },
  { value: 'lotSize|desc', label: 'Lot size, largest first' },
  { value: 'bedrooms|desc', label: 'Most bedrooms' },
  { value: 'bathrooms|desc', label: 'Most bathrooms' },
  { value: 'yearBuilt|desc', label: 'Year built, newest first' },
  { value: 'yearBuilt|asc', label: 'Year built, oldest first' },
];
/** The map docks beside the cards from this width; below it, List and Map are a choice. */
const DOCKED = '(min-width: 1024px)';
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Explore, Zillow-like (asked for on Nov 19, 2026; DESIGN.md §5): the map on the left, the results
 * as photo cards on the right. It opens on the whole country with a state to choose; the results
 * then show as ZentraValue pills on the map and as cards. Picking a card or a pill zooms to that
 * parcel and outlines it in copper. Values are the page's predictions (POST /predictions/bulk);
 * places come from parcel lookups by folio (the exploreMap slice), since results carry no
 * coordinates.
 */
@Component({
  imports: [
    FormsModule,
    RouterLink,
    CountyPicker,
    SignInPrompt,
    RequestStatus,
    Icon,
    Pager,
    ExploreCard,
    ExploreMap,
  ],
  templateUrl: './explore.html',
  styleUrl: './explore.css',
})
export class Explore implements OnInit {
  readonly w = inject(Workspace);
  /** Property reads need an account (401 otherwise): a guest is asked to sign in, and nothing is sent. */
  readonly signedIn = this.w.auth.isLoggedIn();
  private readonly destroyRef = inject(DestroyRef);
  private readonly results = viewChild<ElementRef<HTMLElement>>('results');
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  readonly locations = this.w.store.selectSignal(selectLocations);
  private readonly valuation = this.w.store.selectSignal(selectValuation);
  readonly sorts = SORTS;

  readonly rows = this.w.properties;
  readonly page = computed(() => this.w.catalog().page);
  readonly loading = computed(() => this.w.catalog().loading);
  /** A state (or a county) is chosen: until then the page asks for one. */
  readonly scoped = computed(() => {
    const q = this.w.catalog().query;
    return !!q.state || q.countyId != null;
  });
  readonly values = computed(() => this.valuation().predictions);
  readonly valuesLoading = computed(() => this.valuation().bulkLoading);
  readonly valuesError = computed(() => !!this.valuation().bulkError);
  readonly title = rowTitle;

  /** The property shown on the map (a view concern: it stays in the page, not the store). */
  readonly selected = signal<number | null>(null);
  readonly hovered = signal<number | null>(null);
  /** A card picked again: the map zooms to it once more. */
  readonly reveal = signal<{ id: number } | null>(null);
  readonly selectedRow = computed(() => this.rows().find((r) => r.id === this.selected()) ?? null);
  /** Phones and tablets show the cards or the map; the map, and Leaflet, load once Map is chosen. */
  readonly view = signal<'list' | 'map'>('list');
  readonly docked = signal(true);
  readonly mapWanted = computed(() => this.docked() || this.view() === 'map');

  /** "Miami-Dade, Florida": the chosen county and state, as the location lists name them. */
  readonly placeName = computed(() => {
    const q = this.w.catalog().query;
    const loc = this.locations();
    // A saved search's state comes back in lower case ("fl"): matched without case.
    const state = loc.states.find((s) => s.code.toUpperCase() === q.state?.toUpperCase())?.name ?? q.state;
    const county = loc.counties.find((c) => c.countyId === q.countyId)?.countyName;
    return joinParts(', ', county, state);
  });
  /** The count beside the h1, only for results that answer the current filters. */
  readonly countText = computed(() => {
    const p = this.page();
    const place = this.placeName();
    if (this.loading()) return place ? `Loading properties in ${place}…` : 'Loading properties…';
    if (!p || this.w.catalog().error) return '';
    const count = countOf(p.totalElements, 'property', 'properties');
    return place ? `${count} in ${place}` : count;
  });
  readonly valuesStatus = computed<'loading' | 'error' | 'ready'>(() =>
    this.valuesLoading() ? 'loading' : this.valuesError() ? 'error' : 'ready',
  );
  readonly mapPrompt = computed(() =>
    !this.scoped()
      ? 'Choose a state to see its properties on the map.'
      : this.loading()
        ? 'Loading properties…'
        : this.w.catalog().error
          ? 'Properties could not load. Retry the search in the list.'
          : 'No properties match these filters.',
  );
  readonly sortValue = computed(() => {
    const q = this.w.catalog().query;
    return `${q.sortBy ?? 'id'}|${q.direction ?? 'asc'}`;
  });
  readonly anyMissing = computed(() =>
    this.rows().some(
      (r) => r.bedrooms == null || r.bathrooms == null || r.livingAreaSqft == null || !r.yearBuilt,
    ),
  );

  readonly saveOpen = signal(false);
  readonly saveError = signal('');
  saveName = '';
  private submittedName: string | null = null;
  private focusResults = false;
  private valuesKey = '';
  private placesKey = '';
  /** States were asked for while the list was empty; asked again only once it has filled. */
  private statesAsked = false;
  private openedOnOnlyState = false;
  private readonly pickedEl = viewChild<ElementRef<HTMLElement>>('picked');

  constructor() {
    if (typeof matchMedia === 'function') {
      const mq = matchMedia(DOCKED);
      this.docked.set(mq.matches);
      const onChange = (e: MediaQueryListEvent) => this.docked.set(e.matches);
      mq.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
    }
    // A saved search clears its form once the save went through.
    effect(() => {
      const state = this.w.searchState();
      if (this.submittedName !== null && !state.saving) {
        if (!state.error && this.saveName.trim() === this.submittedName) {
          this.saveName = '';
          this.saveOpen.set(false);
        }
        this.submittedName = null;
      }
    });
    // ZentraValues for the page of results, once per page.
    effect(() => {
      const ids = this.scoped() ? this.rows().map((r) => r.id) : [];
      const key = ids.join(',');
      // No results (a new search, or the session ended and the slices were reset): ask afresh next time.
      if (!ids.length) {
        this.valuesKey = this.placesKey = '';
        return;
      }
      if (key === this.valuesKey) return;
      this.valuesKey = key;
      untracked(() => this.w.store.dispatch(ValuationActions.loadBulk({ propertyIds: ids })));
    });
    // Places for the page's results, once per page while the map is shown (the slice skips
    // properties it has already placed; the map's Retry asks again for failed ones).
    effect(() => {
      const rows = this.scoped() ? this.rows() : [];
      if (!rows.length || !this.mapWanted()) return;
      const key = rows.map((r) => r.id).join(',');
      if (key === this.placesKey) return;
      this.placesKey = key;
      const targets = rows
        .filter((r) => r.folio)
        .map((r) => ({ propertyId: r.id, folio: r.folio, countyId: r.countyId }));
      untracked(() => this.w.store.dispatch(ExploreMapActions.placeProperties({ targets })));
    });
    // The state list, again if a reset emptied it (the county picker only asks when it starts).
    // An empty answer is shown as such rather than asked for in a loop.
    effect(() => {
      const loc = this.locations();
      if (!this.signedIn) return;
      if (loc.states.length) {
        this.statesAsked = false;
        return;
      }
      if (loc.loading || loc.error || this.statesAsked) return;
      this.statesAsked = true;
      untracked(() => this.w.store.dispatch(LocationsActions.loadStates()));
    });
    // A search that names a state the picker doesn't show (a saved search opened from Saved): the
    // picker follows it, county too, once the state list is in.
    effect(() => {
      const loc = this.locations();
      const q = this.w.catalog().query;
      if (!loc.states.length || !q.state || loc.stateId !== null) return;
      const state = loc.states.find((s) => s.code.toUpperCase() === q.state!.toUpperCase());
      if (!state) return;
      untracked(() => {
        this.w.store.dispatch(LocationsActions.selectState({ stateId: state.id }));
        if (q.countyId != null) this.w.store.dispatch(LocationsActions.selectCounty({ countyId: q.countyId }));
      });
    });
    // With properties in one state only, open on it: asking to pick from a list of one is a
    // wasted click on an empty map. With several, the page asks. Once per visit, so clearing the
    // state filter afterwards is respected.
    effect(() => {
      const states = this.locations().states;
      if (this.openedOnOnlyState || this.scoped() || states.length !== 1) return;
      this.openedOnOnlyState = true;
      untracked(() => this.chooseState(states[0]));
    });
    // A selection that left the results (a new filter or page) is dropped.
    effect(() => {
      const rows = this.rows();
      untracked(() => {
        if (this.selected() !== null && !rows.some((r) => r.id === this.selected()))
          this.selected.set(null);
      });
    });
    // After Previous or Next, the results start from the top and take focus (DESIGN.md §7 paging).
    effect(() => {
      if (this.loading() || !this.focusResults) return;
      this.focusResults = false;
      untracked(() => {
        const el = this.results()?.nativeElement;
        if (!el) return;
        // Desktop: the results column scrolls. Below 1024 px the page does.
        if (this.docked()) el.scrollTop = 0;
        else el.scrollIntoView({ block: 'start' });
        el.focus({ preventScroll: true });
      });
    });
  }

  ngOnInit() {
    // Refresh the results the page last showed; with no state chosen yet, it asks for one first.
    if (this.signedIn && this.scoped()) this.w.search({}, false);
  }

  chooseState(state: StateDTO) {
    this.w.store.dispatch(LocationsActions.selectState({ stateId: state.id }));
    this.w.search({ state: state.code, countyId: undefined });
  }
  money(v: number) {
    return usd.format(v);
  }
  retryStates() {
    this.statesAsked = true;
    this.w.store.dispatch(LocationsActions.loadStates());
  }
  filter(query: Partial<PropertySearchRequest>) {
    this.w.search(query);
  }
  setSort(value: string) {
    const [sortBy, direction] = value.split('|') as [SortKey, 'asc' | 'desc'];
    this.w.search({ sortBy, direction });
  }
  goTo(page: number) {
    this.focusResults = true;
    this.w.search({ page }, false);
  }
  retry() {
    this.w.search({}, false);
  }
  retryValues() {
    const ids = this.rows().map((r) => r.id);
    this.valuesKey = ids.join(',');
    if (ids.length) this.w.store.dispatch(ValuationActions.loadBulk({ propertyIds: ids }));
  }
  /** Clears the filters and the sort, keeping the chosen state and county. */
  clearFilters() {
    const q = this.w.catalog().query;
    this.w.store.dispatch(
      CatalogActions.search({
        query: {
          state: q.state,
          countyId: q.countyId,
          page: 0,
          size: 20,
          sortBy: 'id',
          direction: 'asc',
        },
      }),
    );
  }

  /** A card (or its "Show on map"): select it and zoom to it; on phones, switch to the map. */
  pick(id: number) {
    this.selected.set(id);
    this.reveal.set({ id });
    if (this.docked()) return;
    // The card (and its button) disappear with the list: focus moves to the picked property,
    // which is named above the map.
    this.view.set('map');
    setTimeout(() => this.pickedEl()?.nativeElement.focus());
  }
  /** A pill on the map: select it and bring its card into view. */
  pickFromMap(id: number) {
    this.selected.set(id);
    const card = this.results()?.nativeElement.querySelector(`[data-id="${id}"]`);
    card?.scrollIntoView({ block: 'nearest' });
  }

  openSave() {
    if (!this.w.requireAccount('save searches')) return;
    this.saveOpen.set(true);
    this.saveError.set('');
    setTimeout(() => this.nameInput()?.nativeElement.focus());
  }
  closeSave() {
    this.saveOpen.set(false);
    this.saveError.set('');
  }
  save() {
    const name = this.saveName.trim();
    if (!name) {
      this.saveError.set('Enter a name for this search.');
      this.nameInput()?.nativeElement.focus();
      return;
    }
    if (this.w.searchState().saving || !this.w.requireAccount('save searches')) return;
    this.saveError.set('');
    this.submittedName = name;
    this.w.saveSearch(name);
  }
  retrySavedSearch() {
    if (this.w.searchState().errorOperation === 'load')
      this.w.store.dispatch(savedSearchesActions.load({ page: this.w.searchState().page }));
    else this.save();
  }
}
