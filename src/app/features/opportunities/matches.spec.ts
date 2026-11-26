import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { RecommendationsActions } from '../../store/recommendations/recommendations.actions';
import { ValuationActions } from '../../store/valuation/valuation.actions';
import { UserActions } from '../../store/user/user.actions';
import { LocationsActions } from '../../store/locations/locations.actions';
import { KeycloakService } from '../../core/auth/keycloak.service';
import {
  PropertySearchItem,
  RecommendationResponse,
  RecommendationStatus,
  UserPreferencesDTO,
} from '../../core/models/api';
import { PropertyValuePrediction } from '../../core/models/property_prediction_value';
import { Matches } from './matches';

const home = (over: Partial<PropertySearchItem>): PropertySearchItem => ({
  id: 42,
  folio: '0141370120450',
  countyId: 17,
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
  neighborhood: null,
  neighborhoodDescription: null,
  ...over,
});
const COUNTY_REASON = 'Matches your saved target county: Miami-Dade, FL';
const item = (rank: number, property: PropertySearchItem) => ({
  rank,
  property,
  reasons: [COUNTY_REASON],
  budgetMatch: 'UNKNOWN',
  goalMatch: 'UNKNOWN',
  listingStatus: 'UNKNOWN',
});
/** The backend's answers (RecommendationServiceImpl): statuses, limitations and codes as sent. */
const answer = (status: RecommendationStatus, content = [] as ReturnType<typeof item>[]): RecommendationResponse => ({
  status,
  generatedAt: '2026-11-18T15:00:00Z',
  source: 'PROPERTY_RECORDS',
  sourceAsOf: null,
  rankingMethod: 'COUNTY_MATCH_THEN_PROPERTY_ID_ASC',
  limit: 20,
  appliedCountyIds: status === 'NO_PREFERENCES' || status === 'LOCATION_REQUIRED' ? [] : [17],
  minBudget: status === 'PARTIAL' ? 450000 : null,
  maxBudget: status === 'PARTIAL' ? 1100000 : null,
  investmentGoals: status === 'PARTIAL' ? ['Long-term rental income'] : [],
  limitations: [
    'Property records are research suggestions, not confirmed active listings. Listing availability and prices are unavailable.',
  ],
  content,
});
const FULL = home({});
const GAPS = home({ id: 48, address: '11960 SW 186th St', zip: '33177', bedrooms: null });
const CONDO = home({ id: 49, address: '1700 Collins Ave, Unit 1504', city: 'Miami Beach', zip: '33139' });
const PREFS: UserPreferencesDTO = {
  minBudget: 450000,
  maxBudget: 1100000,
  targetLocations: [{ countyId: 17, countyName: 'Miami-Dade', stateCode: 'FL', stateName: 'Florida' }],
  investmentGoals: ['Long-term rental income'],
};
const prediction = (propertyId: number, predictedPrice: number, confidence = 'medium') =>
  ({
    propertyId,
    predictedPrice,
    predictedPriceLow: predictedPrice * 0.9,
    predictedPriceHigh: predictedPrice * 1.1,
    growthPercentage: 0,
    confidence,
    confidenceScore: 70,
    lastSalePrice: null,
    lastSaleDate: null,
    predictionDate: '2026-11-01',
    modelVersion: 'v17',
  }) as PropertyValuePrediction;

describe('Matches for your search', () => {
  let store: Store;
  let dispatched: Action[];
  const auth = { loggedIn: true };

  function setup(
    response: RecommendationResponse | null,
    inputs: Record<string, unknown> = {},
    held: Record<string, PropertyValuePrediction> | null = null,
    /** Store actions before the component starts (e.g. another page's bulk request). */
    prior: Action[] = [],
  ) {
    TestBed.configureTestingModule({
      imports: [Matches],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => auth.loggedIn, hasRealmRole: () => false } },
      ],
    });
    store = TestBed.inject(Store);
    if (auth.loggedIn) store.dispatch(UserActions.preferencesLoaded({ preferences: PREFS }));
    if (held) store.dispatch(ValuationActions.bulkLoaded({ predictions: held }));
    for (const a of prior) store.dispatch(a);
    if (response) store.dispatch(RecommendationsActions.loaded({ response }));
    dispatched = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action) => {
      dispatched.push(a);
      return dispatch(a);
    }) as Store['dispatch']);
    const fixture = TestBed.createComponent(Matches);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const of = <T extends Action>(type: string) => dispatched.filter((a) => a.type === type) as T[];
  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  beforeEach(() => (auth.loggedIn = true));

  it('asks a guest to sign in and loads nothing', () => {
    auth.loggedIn = false;
    const { el } = setup(null);
    expect(el.textContent).toContain('Sign in to see properties matched to your area and budget.');
    expect(of(RecommendationsActions.load.type)).toHaveLength(0);
  });

  it('loads the suggestions once when signed in and none are held', () => {
    const { fixture } = setup(null, { requestLimit: 20 });
    fixture.detectChanges();
    expect(of(RecommendationsActions.load.type)).toEqual([RecommendationsActions.load({ limit: 20 })]);
  });

  it('shows a partial answer as a ranked table and says which preferences were not applied', () => {
    const { fixture, el } = setup(answer('PARTIAL', [item(1, FULL), item(2, GAPS), item(3, CONDO)]));
    expect(of<ReturnType<typeof ValuationActions.loadBulk>>(ValuationActions.loadBulk.type).map((a) => a.propertyIds)).toEqual([
      [42, 48, 49],
    ]);
    store.dispatch(
      ValuationActions.bulkLoaded({ predictions: { '42': prediction(42, 985000), '48': prediction(48, 587000, 'low') } }),
    );
    fixture.detectChanges();
    expect(text(el.querySelector('h2'))).toBe('Matches for your search');
    expect(text(el.querySelector('.mt-applied'))).toBe(
      'Partial: matched on your target county only (Miami-Dade, FL). Your budget and goals were not applied.',
    );
    const head = [...el.querySelectorAll('thead th')].map((th) => text(th));
    // Every match has the county reason: it is said once above the table, and no row adds one.
    expect(head).toEqual(['Rank', 'Property', 'Beds', 'Living area, sq ft', 'ZentraValue']);
    expect(text(el.querySelector('.mt-shared'))).toBe(`Every match: ${COUNTY_REASON}`);
    const rows = [...el.querySelectorAll('tbody tr')];
    const cells = (r: Element) => [...r.querySelectorAll('td')];
    expect(text(cells(rows[0])[0])).toBe('1');
    expect(text(cells(rows[0])[1].querySelector('a'))).toBe('2847 SW 27th Ter');
    // Confidence in the one format: the score with its band (DESIGN.md §9).
    expect(text(cells(rows[0])[4])).toBe('$985,000 Confidence 70 of 100 · Medium');
    // "UNKNOWN" budget and goal checks are not repeated per row.
    expect(el.querySelector('.tag')).toBeNull();
    expect(el.textContent).not.toContain('UNKNOWN');
    // Missing facts and estimates: Unavailable on the hatch, with the reason under the table.
    expect(cells(rows[1])[2].classList).toContain('na');
    expect(text(cells(rows[1])[4].querySelector('.attention'))).toBe('Confidence 70 of 100 · Low');
    expect(cells(rows[2])[4].classList).toContain('na');
    expect(el.textContent).toContain('Unavailable beds: not in the county record.');
    expect(el.textContent).toContain('Unavailable ZentraValue: no estimate was returned for that property.');
    expect(el.textContent).toContain(answer('PARTIAL').limitations[0]);
    // Developer codes stay out of the prose (DESIGN.md §13).
    expect(el.textContent).not.toContain('COUNTY_MATCH_THEN_PROPERTY_ID_ASC');
    expect(el.textContent).toContain('Target-county match first, then record order');
    expect(el.textContent).toContain('Property records');
  });

  it('merges one Unavailable span over the ZentraValue column when the values could not load', () => {
    const { fixture, el } = setup(answer('READY', [item(1, FULL), item(2, CONDO)]));
    expect(text(el.querySelector('.mt-applied'))).toBe('Matched on your target county: Miami-Dade, FL.');
    store.dispatch(ValuationActions.bulkFailed({ error: 'The growth heatmap could not load. Please retry.' }));
    fixture.detectChanges();
    const merged = el.querySelectorAll('td.mt-values-na');
    expect(merged).toHaveLength(1);
    expect(merged[0].getAttribute('rowspan')).toBe('2');
    expect(merged[0].textContent).toContain('ZentraValues could not load.');
    expect(el.textContent).not.toContain('growth heatmap');
    merged[0].querySelector('button')!.click();
    expect(of(ValuationActions.loadBulk.type)).toHaveLength(2);
  });

  it('never opens the first row from the merged span beside the others', () => {
    const { fixture, el } = setup(answer('READY', [item(1, FULL), item(2, CONDO)]));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    store.dispatch(ValuationActions.bulkFailed({ error: 'x' }));
    fixture.detectChanges();
    (el.querySelector('td.mt-values-na') as HTMLElement).click();
    expect(navigate).not.toHaveBeenCalled();
    // A click elsewhere in a row still opens it.
    (el.querySelectorAll('tbody tr')[1].querySelector('td') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(['/property', 49]);
  });

  it('asks for no values it already holds for every row (coming back to the tab)', () => {
    const { el } = setup(answer('READY', [item(1, FULL), item(2, CONDO)]), {}, {
      '42': prediction(42, 985000),
      '49': prediction(49, 640000),
    });
    expect(of(ValuationActions.loadBulk.type)).toHaveLength(0);
    expect(el.textContent).toContain('$640,000');
  });

  it('sorts within the loaded matches, unknown values last, and says so', () => {
    const { fixture, el } = setup(answer('READY', [item(1, FULL), item(2, GAPS), item(3, CONDO)]));
    store.dispatch(
      ValuationActions.bulkLoaded({ predictions: { '42': prediction(42, 985000), '48': prediction(48, 587000) } }),
    );
    fixture.detectChanges();
    const value = [...el.querySelectorAll('thead th')][4];
    value.querySelector('button')!.click();
    fixture.detectChanges();
    const ranks = [...el.querySelectorAll('tbody tr')].map((r) => text(r.querySelector('td')));
    expect(ranks).toEqual(['1', '2', '3']);
    value.querySelector('button')!.click();
    fixture.detectChanges();
    expect([...el.querySelectorAll('tbody tr')].map((r) => text(r.querySelector('td')))).toEqual(['2', '1', '3']);
    expect(el.textContent).toContain('Sorted within these 3 matches');
  });

  it('shows "Set your area and budget" instead of zero matches when no county is saved', () => {
    for (const status of ['NO_PREFERENCES', 'LOCATION_REQUIRED'] as const) {
      TestBed.resetTestingModule();
      const { el } = setup(answer(status));
      expect(text(el.querySelector('h2'))).toBe('Set your area and budget');
      expect(el.querySelector('gz-area-budget-form')).not.toBeNull();
      expect(el.querySelector('table')).toBeNull();
      expect(el.textContent).not.toMatch(/\b0 (matches|properties)\b/);
    }
  });

  it('says there are no matches for these preferences, with Edit preferences', () => {
    const { el } = setup(answer('NO_MATCHES'));
    expect(text(el.querySelector('h2'))).toBe('No matches for these preferences');
    expect(el.textContent).toContain('No property records were found in your target county: Miami-Dade, FL.');
    const edit = [...el.querySelectorAll('a')].find((a) => text(a) === 'Edit preferences')!;
    expect(edit.getAttribute('href')).toBe('/settings');
  });

  it('shows the top rows only, with a link to all of them', () => {
    const { el } = setup(answer('READY', [item(1, FULL), item(2, GAPS), item(3, CONDO)]), { limit: 2 });
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(text(el.querySelector('.mt-count'))).toContain('Top 2 of 3 properties');
    expect(text(el.querySelector('.mt-more a'))).toBe('See all 3 matches');
  });

  it('says when the matches could not load, with Retry', () => {
    const { fixture, el } = setup(null);
    store.dispatch(RecommendationsActions.failed({ error: 'The request could not be completed. Please retry.' }));
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')!.textContent).toContain('Matches could not load.');
    const before = of(RecommendationsActions.load.type).length;
    [...el.querySelectorAll('button')].find((b) => text(b) === 'Retry')!.click();
    expect(of(RecommendationsActions.load.type)).toHaveLength(before + 1);
  });

  it('asks for the values again when another page’s request failed or is still running', () => {
    const held = { '42': prediction(42, 985000), '49': prediction(49, 640000) };
    // The slice keeps one bulk request's status: Explore's, if Explore asked last.
    const others = [
      ValuationActions.bulkFailed({ error: 'x' }),
      ValuationActions.loadBulk({ propertyIds: [7, 8] }),
    ];
    for (const other of others) {
      TestBed.resetTestingModule();
      const { fixture, el } = setup(answer('READY', [item(1, FULL), item(2, CONDO)]), {}, held, [other]);
      const asked = of<ReturnType<typeof ValuationActions.loadBulk>>(ValuationActions.loadBulk.type);
      expect(asked.map((a) => a.propertyIds)).toEqual([[42, 49]]);
      store.dispatch(ValuationActions.bulkLoaded({ predictions: held }));
      fixture.detectChanges();
      expect(el.querySelector('td.mt-values-na')).toBeNull();
      expect(el.textContent).toContain('$640,000');
      expect(el.textContent).not.toContain('no estimate was returned');
    }
  });

  it('loads again once new preferences are saved, even after a failed refresh', () => {
    const { fixture, el } = setup(answer('READY', [item(1, FULL)]));
    store.dispatch(RecommendationsActions.failed({ error: 'x' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('Matches could not refresh.');
    const before = of(RecommendationsActions.load.type).length;
    store.dispatch(UserActions.preferencesSaved({ preferences: PREFS }));
    fixture.detectChanges();
    expect(of(RecommendationsActions.load.type)).toHaveLength(before + 1);
    expect(el.querySelector('[role=alert]')).toBeNull();
  });

  it('keeps the focus in the section when Retry or Refresh is pressed', async () => {
    const { fixture, el } = setup(null);
    store.dispatch(RecommendationsActions.failed({ error: 'x' }));
    fixture.detectChanges();
    const retry = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === 'Retry')!;
    retry.focus();
    retry.click();
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')).toBeNull();
    expect(document.activeElement).toBe(el.querySelector('h2'));
    // The answer replaces the section (skeleton → table): its new heading takes the focus.
    store.dispatch(RecommendationsActions.loaded({ response: answer('READY', [item(1, FULL)]) }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('table')).not.toBeNull();
    expect(document.activeElement).toBe(el.querySelector('section.mt h2'));
    // Refresh stays focusable while it runs (aria-disabled), and asks only once.
    const refresh = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === 'Refresh')!;
    const before = of(RecommendationsActions.load.type).length;
    refresh.focus();
    refresh.click();
    fixture.detectChanges();
    refresh.click();
    expect(of(RecommendationsActions.load.type)).toHaveLength(before + 1);
    expect(refresh.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(refresh);
  });

  it('keeps only a reason that differs between rows, under "Other reasons"', () => {
    const own = { ...item(2, GAPS), reasons: [COUNTY_REASON, 'Has 3 bedrooms or more'] };
    const { el } = setup(answer('READY', [item(1, FULL), own, item(3, CONDO)]));
    expect(text(el.querySelector('.mt-shared'))).toBe(`Every match: ${COUNTY_REASON}`);
    expect(text([...el.querySelectorAll('thead th')].at(-1)!)).toBe('Other reasons');
    const why = [...el.querySelectorAll('tbody tr')].map((r) => text(r.querySelector('td.mt-why')));
    expect(why).toEqual(['No other reason', 'Has 3 bedrooms or more', 'No other reason']);
    // The shared reason is written once on the page.
    expect(el.textContent!.split(COUNTY_REASON)).toHaveLength(2);
  });

  it('keeps per-row reasons as they are when no reason is shared by every match', () => {
    const other = { ...item(2, CONDO), reasons: ['Near your saved search'] };
    const { el } = setup(answer('READY', [item(1, FULL), other]));
    expect(el.querySelector('.mt-shared')).toBeNull();
    expect(text([...el.querySelectorAll('thead th')].at(-1)!)).toBe('Reasons');
    const why = [...el.querySelectorAll('tbody tr')].map((r) => text(r.querySelector('td.mt-why')));
    expect(why).toEqual([COUNTY_REASON, 'Near your saved search']);
  });

  it('writes field names in the backend’s limitations in the page’s words', () => {
    const response = {
      ...answer('READY', [item(1, FULL), item(2, CONDO)]),
      limitations: [
        "Source freshness is unavailable; generatedAt is the response time, not the property data's observation time.",
        'Records as of sourceAsOf.',
      ],
    };
    const { el } = setup(response);
    expect(el.textContent).toContain(
      "Source freshness is unavailable; the “Updated” date is the response time, not the property data's observation time.",
    );
    expect(el.textContent).not.toContain('generatedAt');
    expect(el.textContent).not.toContain('sourceAsOf');
  });
});

describe('Set your area and budget', () => {
  let store: Store;
  let dispatched: Action[];

  function setup(preferences: UserPreferencesDTO | null) {
    TestBed.configureTestingModule({
      imports: [Matches],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => true, hasRealmRole: () => false } },
      ],
    });
    store = TestBed.inject(Store);
    if (preferences) store.dispatch(UserActions.preferencesLoaded({ preferences }));
    store.dispatch(RecommendationsActions.loaded({ response: answer('LOCATION_REQUIRED') }));
    dispatched = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action) => {
      dispatched.push(a);
      return dispatch(a);
    }) as Store['dispatch']);
    const fixture = TestBed.createComponent(Matches);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const save = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('Show matches'))!;
  const field = (el: HTMLElement, name: string) =>
    el.querySelector<HTMLInputElement>('gz-area-budget-form input[name=' + name + ']')!;
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const chooseCounty = () => {
    store.dispatch(LocationsActions.selectState({ stateId: 12 }));
    store.dispatch(LocationsActions.selectCounty({ countyId: 17 }));
  };
  const saves = () =>
    dispatched.filter((a) => a.type === UserActions.savePreferences.type) as ReturnType<
      typeof UserActions.savePreferences
    >[];

  it('says why it can’t save until a county is chosen, tied to the button', async () => {
    const { fixture, el } = setup({ ...PREFS, targetLocations: [] });
    await fixture.whenStable();
    expect(save(el).disabled).toBe(true);
    const why = el.querySelector('.ab-why')!;
    expect(why.textContent).toContain('Choose a state and a county first.');
    expect(save(el).getAttribute('aria-describedby')).toBe(why.id);
    // The budget already saved starts in the fields.
    expect(field(el, 'minBudget').value).toBe('450000');
  });

  it('saves the county and budget with the goals already saved, through the existing action', () => {
    const { fixture, el } = setup({ ...PREFS, targetLocations: [] });
    chooseCounty();
    fixture.detectChanges();
    expect(save(el).disabled).toBe(false);
    expect(save(el).hasAttribute('aria-describedby')).toBe(false);
    save(el).click();
    fixture.detectChanges();
    expect(saves()).toHaveLength(1);
    expect(saves()[0].preferences).toEqual({
      minBudget: 450000,
      maxBudget: 1100000,
      targetLocations: [{ countyId: 17 }],
      investmentGoals: ['Long-term rental income'],
    });
    // Saved preferences drop the old answer; the matches load again on their own.
    store.dispatch(UserActions.preferencesSaved({ preferences: saves()[0].preferences }));
    fixture.detectChanges();
    expect(dispatched.filter((a) => a.type === RecommendationsActions.load.type)).toHaveLength(1);
  });

  it('keeps the counties already saved and adds the new one once', () => {
    const first = setup({
      ...PREFS,
      targetLocations: [
        { countyId: 5, countyName: 'Broward', stateCode: 'FL' },
        { countyId: 17, countyName: 'Miami-Dade', stateCode: 'FL' },
      ],
    });
    chooseCounty();
    first.fixture.detectChanges();
    save(first.el).click();
    expect(saves()[0].preferences.targetLocations).toEqual([{ countyId: 5 }, { countyId: 17 }]);
    TestBed.resetTestingModule();
    const again = setup({ ...PREFS, targetLocations: [{ countyId: 5, countyName: 'Broward', stateCode: 'FL' }] });
    chooseCounty();
    again.fixture.detectChanges();
    save(again.el).click();
    expect(saves()[0].preferences.targetLocations).toEqual([{ countyId: 5 }, { countyId: 17 }]);
  });

  it('refuses a budget below $0 or a lowest budget above the highest, and says why', async () => {
    const { fixture, el } = setup({ ...PREFS, targetLocations: [] });
    await fixture.whenStable();
    chooseCounty();
    type(field(el, 'minBudget'), '900000');
    type(field(el, 'maxBudget'), '400000');
    fixture.detectChanges();
    expect(save(el).disabled).toBe(true);
    expect(el.querySelector('.ab-why')!.textContent).toContain(
      'The lowest budget must not be above the highest.',
    );
    type(field(el, 'minBudget'), '-5');
    fixture.detectChanges();
    expect(el.querySelector('.ab-why')!.textContent).toContain('A budget can’t be below $0.');
    save(el).click();
    expect(saves()).toHaveLength(0);
  });

  it('keeps a budget typed before the saved one arrives', async () => {
    const { fixture, el } = setup(null);
    await fixture.whenStable();
    type(field(el, 'maxBudget'), '700000');
    store.dispatch(UserActions.preferencesLoaded({ preferences: PREFS }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(field(el, 'maxBudget').value).toBe('700000');
    expect(field(el, 'minBudget').value).toBe('450000');
  });

  it('won’t save over preferences it could not load, and retries them', () => {
    const { fixture, el } = setup(null);
    store.dispatch(UserActions.preferencesLoadFailed({ error: 'The service could not be reached.' }));
    fixture.detectChanges();
    expect(save(el).disabled).toBe(true);
    const alert = el.querySelector('[role=alert]')!;
    expect(alert.textContent).toContain('Your saved preferences could not load');
    alert.querySelector('button')!.click();
    expect(dispatched.at(-1)).toEqual(UserActions.loadPreferences());
  });

  it('says so when the account itself could not load, instead of loading forever', () => {
    const { fixture, el } = setup(null);
    store.dispatch(UserActions.failed({ error: 'The service could not be reached.' }));
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Loading your saved preferences');
    const alert = el.querySelector('[role=alert]')!;
    expect(alert.textContent).toContain('Your account could not load');
    alert.querySelector('button')!.click();
    expect(dispatched.at(-1)).toEqual(UserActions.load());
  });
});
