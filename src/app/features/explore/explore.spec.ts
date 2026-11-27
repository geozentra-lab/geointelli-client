import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import { LocationsActions } from '../../store/locations/locations.actions';
import { savedSearchesActions } from '../../store/saved-searches/saved-searches.actions';
import { ValuationActions } from '../../store/valuation/valuation.actions';
import { ExploreMapActions } from '../../store/explore-map/explore-map.actions';
import { UserActions } from '../../store/user/user.actions';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { Page, PropertySearchItem } from '../../core/models/api';
import { PropertyValuePrediction } from '../../core/models/property_prediction_value';
import { Explore } from './explore';

const row = (over: Partial<PropertySearchItem>): PropertySearchItem => ({
  id: 42,
  folio: '0141370120450',
  countyId: 1,
  countyName: 'Miami-Dade',
  stateCode: 'FL',
  stateName: 'Florida',
  address: '2847 SW 27th Ter',
  city: 'Miami',
  zip: '33133',
  dorCode: '0101',
  propertyType: 'Single family',
  bedrooms: 3,
  bathrooms: 2,
  livingAreaSqft: 1840,
  lotSize: 6250,
  yearBuilt: '1952',
  neighborhood: '1',
  neighborhoodDescription: 'Silver Bluff',
  ...over,
});
const FULL = row({});
/** Vacant land: no street address, no building facts, no estimate. */
const LAND = row({
  id: 55,
  folio: '0141370120380',
  address: null,
  propertyType: 'Vacant residential land',
  bedrooms: null,
  bathrooms: null,
  livingAreaSqft: null,
  lotSize: 5800,
  yearBuilt: null,
});
const FLORIDA = { id: 12, code: 'FL', name: 'Florida' };
const ALABAMA = { id: 1, code: 'AL', name: 'Alabama' };
const page = (content: PropertySearchItem[], totalElements = content.length, n = 0): Page<PropertySearchItem> => ({
  content,
  page: n,
  size: 20,
  totalElements,
  totalPages: Math.ceil(totalElements / 20),
});
const prediction = (propertyId: number, predictedPrice: number): PropertyValuePrediction =>
  ({
    propertyId,
    predictedPrice,
    predictedPriceLow: predictedPrice * 0.9,
    predictedPriceHigh: predictedPrice * 1.1,
    growthPercentage: 0,
    confidence: 'medium',
    confidenceScore: 70,
    lastSalePrice: null,
    lastSaleDate: null,
    predictionDate: '2026-11-01',
    modelVersion: 'v17',
  }) as PropertyValuePrediction;

describe('Explore', () => {
  let store: Store;
  let dispatched: Action[];
  const auth = { loggedIn: false };

  /** With `results`, Florida is already chosen and its first page loaded. */
  async function setup(results?: Page<PropertySearchItem>, states = [FLORIDA, ALABAMA]) {
    TestBed.configureTestingModule({
      imports: [Explore],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => auth.loggedIn } },
      ],
      // The map has its own spec; here it stays a placeholder.
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    // The map is a deferred dependency of the page: resolve it before creating the page.
    await TestBed.compileComponents();
    store = TestBed.inject(Store);
    store.dispatch(LocationsActions.statesLoaded({ states }));
    if (results) {
      store.dispatch(
        CatalogActions.search({ query: { state: 'FL', page: 0, size: 20, sortBy: 'id', direction: 'asc' } }),
      );
      store.dispatch(CatalogActions.loaded({ page: results }));
    }
    dispatched = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action) => {
      dispatched.push(a);
      return dispatch(a);
    }) as Store['dispatch']);
    const fixture = TestBed.createComponent(Explore);
    fixture.detectChanges();
    // Opening the page refreshes the chosen state's results: answer that request too.
    if (results) {
      store.dispatch(CatalogActions.loaded({ page: results }));
      fixture.detectChanges();
    }
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const of = <T extends Action>(type: string) => dispatched.filter((a) => a.type === type) as T[];
  const searches = () => of<ReturnType<typeof CatalogActions.search>>(CatalogActions.search.type);
  const button = (el: HTMLElement, text: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === text)!;
  // Explore needs an account (the backend answers 401 to a guest): signed in unless a test says not.
  beforeEach(() => (auth.loggedIn = true));

  it('opens on the map with a state to choose, and searches that state when one is picked', async () => {
    const { el } = await setup();
    expect(searches()).toHaveLength(0);
    expect(el.textContent).toContain('Choose a state to see its properties on the map.');
    expect(el.querySelector('gz-explore-card')).toBeNull();
    button(el, 'Florida').click();
    expect(of(LocationsActions.selectState.type)).toEqual([LocationsActions.selectState({ stateId: 12 })]);
    expect(searches().at(-1)!.query).toMatchObject({ state: 'FL', page: 0 });
  });

  it('opens on the only state that has properties instead of asking to pick from a list of one', async () => {
    const { fixture } = await setup(undefined, [FLORIDA]);
    expect(of(LocationsActions.selectState.type)).toEqual([LocationsActions.selectState({ stateId: 12 })]);
    expect(searches()).toHaveLength(1);
    expect(searches()[0].query).toMatchObject({ state: 'FL', page: 0 });
    // Clearing the state afterwards is respected: it isn't chosen again.
    store.dispatch(CatalogActions.search({ query: { page: 0, size: 20 } }));
    fixture.detectChanges();
    expect(of(LocationsActions.selectState.type)).toHaveLength(1);
    expect(searches()).toHaveLength(2);
  });

  it('shows the results as cards led by the ZentraValue, Unavailable where there is none', async () => {
    const { fixture, el } = await setup(page([FULL, LAND]));
    expect(el.querySelector('.ex-count')!.textContent!.trim()).toBe('2 properties in Florida');
    store.dispatch(ValuationActions.bulkLoaded({ predictions: { '42': prediction(42, 985000) } }));
    fixture.detectChanges();
    const cards = el.querySelectorAll('gz-explore-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('.xc-figure')!.textContent).toBe('$985,000');
    expect(cards[0].textContent).toContain('Confidence 70 of 100 · Medium');
    expect(cards[0].textContent).toContain('3 beds · 2 baths · 1,840 sq ft · Built 1952');
    expect(cards[0].querySelector('a')!.textContent!.trim()).toBe('2847 SW 27th Ter');
    // No estimate, no address, no building facts: each said plainly, never 0 or a dash.
    expect(cards[1].querySelector('.xc-value.na .na-word')!.textContent).toBe('Unavailable');
    expect(cards[1].textContent).toContain('No estimate was returned for this property.');
    expect(cards[1].textContent).toContain('Unavailable: beds, baths, living area, year built');
    expect(cards[1].querySelector('a')!.textContent!.trim()).toBe('Folio 01-4137-012-0380');
    expect(cards[1].textContent).toContain('No street address on record');
    expect(cards[1].textContent).not.toMatch(/\bnull\b|\$0\b|—/);
    expect(el.querySelector('.ex-notes')!.textContent).toContain('not an asking price');
  });

  it('asks once per page for the values and the places of the results', async () => {
    const { fixture } = await setup(page([FULL, LAND]));
    fixture.detectChanges();
    expect(of<ReturnType<typeof ValuationActions.loadBulk>>(ValuationActions.loadBulk.type).map((a) => a.propertyIds)).toEqual([[42, 55]]);
    const place = of<ReturnType<typeof ExploreMapActions.placeProperties>>(ExploreMapActions.placeProperties.type);
    expect(place.at(-1)!.targets).toEqual([
      { propertyId: 42, folio: FULL.folio, countyId: 1 },
      { propertyId: 55, folio: LAND.folio, countyId: 1 },
    ]);
    // The catalog re-emits the same page (photos arriving): no second request for its values.
    store.dispatch(CatalogActions.photoLoaded({ id: 42, images: [] }));
    fixture.detectChanges();
    expect(of(ValuationActions.loadBulk.type)).toHaveLength(1);
    expect(of(ExploreMapActions.placeProperties.type)).toHaveLength(1);
  });

  it('sorts on the server from one select, unknown values last', async () => {
    const { fixture, el } = await setup(page([FULL, LAND]));
    const sort = el.querySelector<HTMLSelectElement>('select[aria-label="Sort properties"]')!;
    sort.value = 'livingAreaSqft|desc';
    sort.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(searches().at(-1)!.query).toMatchObject({
      state: 'FL',
      sortBy: 'livingAreaSqft',
      direction: 'desc',
      page: 0,
    });
    expect(el.textContent).toContain('Sorted across all results; properties without a value come last.');
  });

  it('picks a card for the map and drops a pick that left the results', async () => {
    const { fixture, el } = await setup(page([FULL, LAND]));
    const cards = () => [...el.querySelectorAll('gz-explore-card')];
    expect(fixture.componentInstance.selected()).toBeNull();
    button(cards()[1] as HTMLElement, 'Show on map').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe(55);
    expect(cards()[1].classList).toContain('sel');
    // A click on the card itself picks it too; its links and controls keep their own job.
    (cards()[0].querySelector('.xc-facts') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe(42);
    store.dispatch(CatalogActions.loaded({ page: page([LAND]) }));
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBeNull();
  });

  it('pages over the server pages and clears the filters, keeping the state, from the empty state', async () => {
    const { fixture, el } = await setup(page([FULL, LAND], 25));
    expect(el.querySelector('.pager')!.textContent).toContain('1 to 20 of 25');
    button(el, 'Next').click();
    expect(searches().at(-1)!.query.page).toBe(1);
    store.dispatch(CatalogActions.loaded({ page: page([]) }));
    fixture.detectChanges();
    expect(el.textContent).toContain('No properties match these filters.');
    button(el, 'Clear filters').click();
    expect(searches().at(-1)!.query).toEqual({
      state: 'FL',
      countyId: undefined,
      page: 0,
      size: 20,
      sortBy: 'id',
      direction: 'asc',
    });
  });

  it('on phones, places results only once Map is chosen, and moves focus to the pick', async () => {
    const original = globalThis.matchMedia;
    globalThis.matchMedia = ((q: string) =>
      ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
    try {
      const { fixture, el } = await setup(page([FULL, LAND]));
      expect(of(ExploreMapActions.placeProperties.type)).toHaveLength(0);
      expect(of(ValuationActions.loadBulk.type)).toHaveLength(1);
      button(el.querySelector('gz-explore-card') as HTMLElement, 'Show on map').click();
      fixture.detectChanges();
      expect(fixture.componentInstance.view()).toBe('map');
      expect(of(ExploreMapActions.placeProperties.type)).toHaveLength(1);
      await new Promise((r) => setTimeout(r));
      expect(document.activeElement).toBe(el.querySelector('.ex-picked'));
      expect(el.querySelector('.ex-picked')!.textContent).toContain('2847 SW 27th Ter');
    } finally {
      globalThis.matchMedia = original;
    }
  });

  it('never pairs the old count with a new place, and the map tells a failed search from no match', async () => {
    const { fixture, el } = await setup(page([FULL, LAND]));
    store.dispatch(
      CatalogActions.search({ query: { state: 'GA', page: 0, size: 20, sortBy: 'id', direction: 'asc' } }),
    );
    fixture.detectChanges();
    expect(el.querySelector('.ex-count')!.textContent!.trim()).toBe('Loading properties in GA…');
    store.dispatch(CatalogActions.failed({ error: 'The search service is unavailable.' }));
    fixture.detectChanges();
    expect(el.querySelector('.ex-count')).toBeNull();
    expect(el.textContent).toContain('Showing your previous results.');
    expect(fixture.componentInstance.mapPrompt()).toBe(
      'Properties could not load. Retry the search in the list.',
    );
  });

  it('asks for the states again after a reset, and says so when there are none', async () => {
    const { fixture, el } = await setup();
    // The session ended: the slices are reset while the page stays open.
    store.dispatch(UserActions.signedOut());
    fixture.detectChanges();
    expect(of(LocationsActions.loadStates.type)).toHaveLength(1);
    expect(el.textContent).toContain('Loading states…');
    store.dispatch(LocationsActions.statesLoaded({ states: [] }));
    fixture.detectChanges();
    expect(el.textContent).toContain('No states are available yet.');
    // An empty answer is not asked for again in a loop.
    expect(of(LocationsActions.loadStates.type)).toHaveLength(1);
  });

  it('asks a guest to sign in instead of the page, and sends nothing', async () => {
    auth.loggedIn = false;
    const { el } = await setup();
    expect(el.querySelector('h1')!.textContent).toContain('Sign in to explore properties');
    expect(el.querySelector('gz-county-picker')).toBeNull();
    expect(of(LocationsActions.loadStates.type)).toHaveLength(0);
    expect(searches()).toHaveLength(0);
  });

  it('saves a named search and says why it cannot save without a name', async () => {
    const { fixture, el } = await setup(page([FULL]));
    const save = button(el, 'Save search');
    save.click();
    fixture.detectChanges();
    // Template-driven fields register with the form a tick later.
    await fixture.whenStable();
    const form = el.querySelector('#save-search') as HTMLFormElement;
    expect(save.getAttribute('aria-expanded')).toBe('true');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(el.querySelector('#save-search-error')!.textContent).toContain('Enter a name for this search.');
    expect(of(savedSearchesActions.create.type)).toHaveLength(0);
    const input = form.querySelector('input') as HTMLInputElement;
    input.value = 'Florida, 3 beds';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    form.dispatchEvent(new Event('submit'));
    const create = of<ReturnType<typeof savedSearchesActions.create>>(savedSearchesActions.create.type)[0];
    expect(create.request).toMatchObject({ name: 'Florida, 3 beds', cadence: 'DAILY', paused: false });
    expect(create.request.filters).toMatchObject({ state: 'FL' });
  });
});
