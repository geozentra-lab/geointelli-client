import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { PropertySearchItem, SavedSearchDTO } from '../../core/models/api';
import { PropertyValuePrediction } from '../../core/models/property_prediction_value';
import { favoritesActions as F } from '../../store/favorites/favorites.actions';
import { savedSearchesActions as A } from '../../store/saved-searches/saved-searches.actions';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import { ValuationActions } from '../../store/valuation/valuation.actions';
import { Saved } from './saved';
import { searchWords } from './search-words';

const home = (id: number, over: Partial<PropertySearchItem> = {}): PropertySearchItem => ({
  id,
  folio: '01413701204' + id,
  countyId: 17,
  countyName: 'Miami-Dade',
  stateCode: 'FL',
  stateName: 'Florida',
  address: `${id} SW 27th Ter`,
  city: 'Miami',
  zip: '33133',
  dorCode: '0101',
  propertyType: 'Single family',
  bedrooms: 3,
  bathrooms: 2,
  livingAreaSqft: 1840,
  lotSize: 6250,
  yearBuilt: '1952',
  neighborhood: null,
  neighborhoodDescription: null,
  ...over,
});
const prediction = (propertyId: number, predictedPrice: number) =>
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
const search = (id: number, name: string, over: Partial<SavedSearchDTO> = {}): SavedSearchDTO => ({
  id,
  name,
  filters: { zip: '33133', propertyType: 'Single family', minBedrooms: 3 },
  filtersVersion: 1,
  cadence: 'DAILY',
  paused: false,
  createdAt: '2026-10-10T12:00:00Z',
  updatedAt: '2026-11-18T12:00:00Z',
  ...over,
});

describe('Saved', () => {
  let store: Store;
  let dispatched: Action[];
  const auth = { loggedIn: true };
  const confirm = vi.fn(async () => true);
  beforeEach(() => {
    auth.loggedIn = true;
    confirm.mockClear();
  });

  async function setup(url = '/') {
    TestBed.configureTestingModule({
      imports: [Saved],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => auth.loggedIn, hasRealmRole: () => false } },
        { provide: ConfirmationService, useValue: { confirm } },
      ],
    });
    await TestBed.inject(Router).navigateByUrl(url);
    store = TestBed.inject(Store);
    dispatched = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action) => {
      dispatched.push(a);
      return dispatch(a);
    }) as Store['dispatch']);
    const fixture = TestBed.createComponent(Saved);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    return { fixture, el };
  }
  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  /** Text as read: each text node apart (a label and its value are separate blocks). */
  const spaced = (el: Element | null) => {
    const walk = document.createTreeWalker(el!, NodeFilter.SHOW_TEXT);
    const out: string[] = [];
    while (walk.nextNode()) out.push(walk.currentNode.textContent!);
    return out.join(' ').replace(/\s+/g, ' ').trim();
  };
  const of = <T extends Action>(type: string) => dispatched.filter((a) => a.type === type) as T[];
  function holdFavorites(...homes: PropertySearchItem[]) {
    store.dispatch(CatalogActions.cacheItems({ items: homes }));
    store.dispatch(
      F.loaded({
        items: homes.map((h, i) => ({ propertyId: h.id, favorite: true, createdAt: `2026-11-1${8 - i}T12:00:00Z` })),
      }),
    );
    // The slice asks for each saved property's details; they have answered.
    for (const h of homes) store.dispatch(F.propertyLoaded({ propertyId: h.id }));
  }

  it('asks a guest to sign in and loads nothing', async () => {
    auth.loggedIn = false;
    const { el } = await setup();
    expect(text(el.querySelector('h1'))).toBe('Saved');
    expect(el.textContent).toContain('Sign in to keep a shortlist');
    expect(of(F.load.type)).toHaveLength(0);
    expect(of(A.load.type)).toHaveLength(0);
  });

  it('lists saved properties as a table led by facts and the ZentraValue, newest first', async () => {
    const { fixture, el } = await setup();
    expect(of(F.load.type)).toHaveLength(1);
    expect(of(A.load.type)).toHaveLength(1);
    holdFavorites(home(42), home(43, { bedrooms: null }), home(44));
    fixture.detectChanges();
    expect(of<ReturnType<typeof ValuationActions.loadBulk>>(ValuationActions.loadBulk.type).map((a) => a.propertyIds)).toEqual([[42, 43, 44]]);
    store.dispatch(ValuationActions.bulkLoaded({ predictions: { '42': prediction(42, 985000) } }));
    fixture.detectChanges();
    const rows = [...el.querySelectorAll('.sv-table tbody tr')];
    expect(rows).toHaveLength(3);
    expect(text(rows[0].querySelector('td'))).toContain('42 SW 27th Ter');
    expect(spaced(rows[0])).toContain('$985,000 Confidence 70 of 100 · Medium');
    expect(rows[1].querySelectorAll('td')[1].classList).toContain('na');
    // Two without an estimate: one plural note, never a dash or $0.
    expect(el.textContent).toContain('Unavailable ZentraValue: no estimate was returned for those properties.');
    expect(el.textContent).toContain('Unavailable facts: not in the county record.');
    expect(text(el.querySelector('#sv-tab-properties'))).toBe('Properties 3');
  });

  it('opens a property from its row and removes one with focus kept on the page', async () => {
    const { fixture, el } = await setup();
    holdFavorites(home(42), home(43));
    fixture.detectChanges();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (el.querySelector('.sv-table tbody tr td:nth-child(2)') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(['/property', 42]);
    const remove = el.querySelector<HTMLButtonElement>('.sv-table tbody tr .sv-remove button')!;
    expect(remove.getAttribute('aria-label')).toBe('Remove 42 SW 27th Ter from saved');
    remove.focus();
    remove.click();
    expect(of<ReturnType<typeof F.remove>>(F.remove.type)[0].propertyId).toBe(42);
    expect(document.activeElement).toBe(el.querySelector('#sv-tab-properties'));
  });

  it('says what will appear when nothing is saved', async () => {
    const { fixture, el } = await setup();
    store.dispatch(F.loaded({ items: [] }));
    fixture.detectChanges();
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('Properties you save from Explore or a property page appear here.');
    expect(el.textContent).not.toMatch(/\b0 (saved|properties)/);
  });

  it('lists saved searches with their filters in words; a row opens it in the pane', async () => {
    const { fixture, el } = await setup('/?view=searches');
    store.dispatch(
      A.loaded({
        page: {
          content: [search(11, '33133 houses, 3+ beds'), search(13, 'Upper East Side duplexes', { paused: true, cadence: 'WEEKLY' })],
          page: 0,
          size: 20,
          totalElements: 2,
          totalPages: 1,
        },
      }),
    );
    fixture.detectChanges();
    const rows = [...el.querySelectorAll('.sv-table tbody tr')];
    expect(spaced(rows[0])).toContain('33133 houses, 3+ beds ZIP 33133 · Single family · 3+ beds');
    expect(spaced(rows[1])).toContain('Weekly Paused');
    (rows[0].querySelector('td') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const pane = el.querySelector('.desk-slot gz-record-pane')!;
    expect(text(pane.querySelector('h2, .pane-title'))).toContain('33133 houses, 3+ beds');
    expect(of<ReturnType<typeof A.loadPreview>>(A.loadPreview.type)[0].id).toBe(11);
    // The form says why it can't save, then sends only what changed.
    expect(text(pane)).toContain('Nothing has changed.');
    const cadence = pane.querySelector<HTMLSelectElement>('select')!;
    cadence.value = 'WEEKLY';
    cadence.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    pane.querySelector<HTMLFormElement>('.ss-form')!.dispatchEvent(new Event('submit'));
    expect(of<ReturnType<typeof A.update>>(A.update.type)[0]).toMatchObject({ id: 11, request: { cadence: 'WEEKLY' } });
    // Its matches today.
    store.dispatch(A.previewLoaded({ id: 11, page: { content: [home(42)], page: 0, size: 20, totalElements: 1, totalPages: 1 } }));
    fixture.detectChanges();
    expect(text(pane)).toContain('1 property matches today.');
    expect(pane.querySelector('.ss-matches a')!.getAttribute('href')).toBe('/property/42');
  });

  it('deletes a saved search after confirming, closing its pane', async () => {
    const { fixture, el } = await setup('/?view=searches');
    store.dispatch(A.loaded({ page: { content: [search(11, 'Mine')], page: 0, size: 20, totalElements: 1, totalPages: 1 } }));
    fixture.detectChanges();
    (el.querySelector('.sv-table tbody tr td') as HTMLElement).click();
    fixture.detectChanges();
    const del = [...el.querySelectorAll<HTMLButtonElement>('.sv-pane-actions button')].find((b) => text(b) === 'Delete')!;
    del.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(confirm).toHaveBeenCalled();
    expect(of<ReturnType<typeof A.remove>>(A.remove.type)[0].id).toBe(11);
    expect(el.querySelector('.desk-slot')).toBeNull();
    expect(document.activeElement).toBe(el.querySelector('#sv-tab-searches'));
  });

  it('follows the address: the nav’s Saved link brings back Properties', async () => {
    const { fixture, el } = await setup('/?view=searches');
    expect(el.querySelector('#sv-tab-searches')!.getAttribute('aria-selected')).toBe('true');
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    expect(el.querySelector('#sv-tab-properties')!.getAttribute('aria-selected')).toBe('true');
  });

  it('asks for the values once the details have settled, not once per detail', async () => {
    const { fixture } = await setup();
    store.dispatch(F.loaded({ items: [42, 43].map((id) => ({ propertyId: id, favorite: true, createdAt: '2026-11-18T12:00:00Z' })) }));
    fixture.detectChanges();
    // Details still loading (the slice asks for each): no value request yet.
    expect(of(ValuationActions.loadBulk.type)).toHaveLength(0);
    store.dispatch(CatalogActions.cacheItems({ items: [home(42)] }));
    store.dispatch(F.propertyLoaded({ propertyId: 42 }));
    fixture.detectChanges();
    expect(of(ValuationActions.loadBulk.type)).toHaveLength(0);
    store.dispatch(CatalogActions.cacheItems({ items: [home(43)] }));
    store.dispatch(F.propertyLoaded({ propertyId: 43 }));
    fixture.detectChanges();
    expect(of<ReturnType<typeof ValuationActions.loadBulk>>(ValuationActions.loadBulk.type).map((a) => a.propertyIds)).toEqual([[42, 43]]);
  });

  it('keeps the table’s columns for a row whose details could not load', async () => {
    const { fixture, el } = await setup();
    store.dispatch(CatalogActions.cacheItems({ items: [home(42)] }));
    store.dispatch(F.loaded({ items: [42, 43].map((id) => ({ propertyId: id, favorite: true, createdAt: '2026-11-18T12:00:00Z' })) }));
    store.dispatch(F.propertyFailed({ propertyId: 43, error: 'x' }));
    store.dispatch(ValuationActions.bulkFailed({ error: 'x' }));
    fixture.detectChanges();
    const width = (r: Element) =>
      [...r.querySelectorAll('td')].reduce((n, td) => n + Number(td.getAttribute('colspan') ?? 1), 0);
    const [first, second] = [...el.querySelectorAll('.sv-table tbody tr')];
    // The merged value span sits in the first row and covers the second.
    expect(width(first)).toBe(7);
    expect(width(second)).toBe(6);
    expect(first.querySelector('.sv-values-na')!.getAttribute('rowspan')).toBe('2');
    expect(text(second)).toContain('Its details could not load.');
  });

  it('shows no count on a tab whose list failed to load', async () => {
    const { fixture, el } = await setup();
    store.dispatch(A.failed({ error: 'Saved searches could not load.', operation: 'load' }));
    fixture.detectChanges();
    expect(text(el.querySelector('#sv-tab-searches'))).toBe('Searches');
  });
});

describe('Saved search filters in words', () => {
  it('writes only what the search sets, in reading order', () => {
    expect(searchWords({ countyId: 17, city: 'Hialeah', propertyType: 'Condominium', minBedrooms: 2, maxBedrooms: 2 }, 'Miami-Dade')).toEqual([
      'Miami-Dade County',
      'Hialeah',
      'Condominium',
      '2 beds',
    ]);
    expect(searchWords({ zip: '33177', minBedrooms: 4, minYearBuilt: 1990, maxLivingAreaSqft: 1000 })).toEqual([
      'ZIP 33177',
      '4+ beds',
      'Up to 1,000 sq ft',
      'Built 1990 or later',
    ]);
    expect(searchWords({ minBathrooms: 1, maxBathrooms: 1 })).toEqual(['1 bath']);
    expect(searchWords({})).toEqual([]);
    // A county-only search whose name isn't loaded never reads as "every property".
    expect(searchWords({ countyId: 17 })).toEqual(['One county (its name isn’t loaded)']);
    expect(searchWords({ countyId: 17, zip: '33133' })).toEqual(['ZIP 33133']);
  });
});
