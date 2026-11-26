import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { actAs } from '../../store/account/account.testing';
import { OpportunitiesActions as O } from '../../store/opportunities/opportunities.actions';
import { RecommendationsActions } from '../../store/recommendations/recommendations.actions';
import { LocationsActions } from '../../store/locations/locations.actions';
import { UserActions } from '../../store/user/user.actions';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { ShellLayer } from '../../shared/layout/shell-layer';
import {
  OpportunityFactor,
  OpportunityItem,
  OpportunityPageDTO,
  OpportunityQuery,
} from '../../core/models/opportunity';
import { Opportunities } from './opportunities';
import {
  confidenceLow,
  confidenceText,
  opportunityTitle,
  signedPercent,
  sortFromColumn,
  strongestFactors,
} from './opportunity-rows';

const factor = (over: Partial<OpportunityFactor>): OpportunityFactor => ({
  code: 'FORECAST_GROWTH_1Y',
  label: 'One-year forecast growth',
  category: 'MARKET',
  weight: 20,
  status: 'AVAILABLE',
  signal: 4.2,
  signalUnit: 'PERCENT',
  subscore: 71,
  points: 14.2,
  explanation: 'One-year forecast +4.2% against the current estimate.',
  ...over,
});
const RENT = factor({
  code: 'RENTAL_YIELD',
  label: 'Rental yield',
  category: 'RENT',
  status: 'UNAVAILABLE',
  signal: null,
  signalUnit: null,
  subscore: null,
  points: null,
  explanation: 'Unavailable: No rent estimate is stored for this property. It adds no points.',
});
const CONFIDENCE = factor({
  code: 'VALUATION_CONFIDENCE',
  label: 'Valuation confidence',
  category: 'VALUATION',
  weight: 10,
  signal: 78,
  signalUnit: 'SCORE',
  points: 7.8,
  // The backend's own words: the band is stated here, and nowhere else on an opportunity row.
  explanation:
    "The valuation's confidence score is 78 of 100 (medium confidence); it is used as the subscore.",
});
const opportunity = (over: Partial<OpportunityItem>): OpportunityItem => ({
  propertyId: 42,
  folio: '0141370120450',
  address: '2847 SW 27th Ter',
  city: 'Miami',
  zip: '33133',
  countyName: 'Miami-Dade',
  stateCode: 'FL',
  score: 36.26,
  maxScore: 100,
  coveragePercent: 50,
  estimatedValue: 985000,
  forecastGrowth1yPct: 4.2,
  factors: [factor({}), CONFIDENCE, RENT],
  valuationRunId: 'zv-run-2026-11-02',
  valuationDataThrough: '2026-10-31',
  scoredAt: '2026-11-15T15:00:00Z',
  ...over,
});
const A = opportunity({});
/** No stored estimate or forecast, no confidence factor, no street address. */
const B = opportunity({
  propertyId: 55,
  address: null,
  score: 12,
  coveragePercent: 35,
  estimatedValue: null,
  forecastGrowth1yPct: null,
  factors: [factor({ points: 12 }), RENT],
});
const page = (content: OpportunityItem[], status = 'OK'): OpportunityPageDTO => ({
  scoreVersion: 'opportunity-v1',
  status,
  filters: { countyId: null, stateId: null, minScore: null, minValue: null, maxValue: null },
  sort: 'SCORE_DESC',
  results: { content, page: 0, size: 12, totalElements: content.length, totalPages: 1 },
  notes: [
    'Version opportunity-v1 scores the stored ZentraValue valuation and market forecasts; rent, financing and listing-price evidence is not stored yet, so those factors are unavailable.',
    'Forecasts are model trend scenarios, not guarantees.',
    'Unavailable factors add no points and are never treated as zero costs: missing data cannot raise a score. coveragePercent is the highest score the available evidence allows.',
  ],
});
/** A filtered query and its answer, applied as the page would have applied them. */
const applied = (query: OpportunityQuery, answer: OpportunityPageDTO) => [
  O.browse({ query }),
  O.browsed({ query, page: answer }),
];

describe('Opportunities page', () => {
  let store: Store;
  let dispatched: Action[];

  async function setup(results: OpportunityPageDTO | null, view: 'scored' | 'matches' = 'scored') {
    TestBed.configureTestingModule({
      imports: [Opportunities],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => true, hasRealmRole: () => false } },
      ],
    });
    // The tab comes from the address (?view=matches).
    await TestBed.inject(Router).navigateByUrl(view === 'matches' ? '/?view=matches' : '/');
    store = TestBed.inject(Store);
    // Rental analysis and Top scored are the investor's (features.investment).
    actAs(store, 'investor');
    const query: OpportunityQuery = { page: 0, size: 12, sort: 'SCORE_DESC' };
    if (results) {
      store.dispatch(O.browse({ query }));
      store.dispatch(O.browsed({ query, page: results }));
    }
    dispatched = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action) => {
      dispatched.push(a);
      return dispatch(a);
    }) as Store['dispatch']);
    const fixture = TestBed.createComponent(Opportunities);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const browses = () =>
    dispatched.filter((a) => a.type === O.browse.type) as ReturnType<typeof O.browse>[];
  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  const rows = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.opp-table tbody tr')];
  const cells = (r: Element) => [...r.querySelectorAll('td')];

  it('names the page plainly: no eyebrow, no slogan', async () => {
    const { el } = await setup(page([A]));
    expect(text(el.querySelector('h1'))).toBe('Opportunities');
    expect(el.textContent).not.toContain('OPPORTUNITIES');
    expect(el.textContent).not.toContain('worth a closer look');
  });

  it('ranks the scored properties in a table: rank, score and coverage, ZentraValue, forecast', async () => {
    const { el } = await setup(page([A, B]));
    const head = [...el.querySelectorAll('.opp-table thead th')].map((th) => text(th));
    expect(head).toEqual([
      'Rank',
      'Property',
      'Score, of 100↓',
      'ZentraValue',
      'Next 12 months',
      'Strongest evidence',
    ]);
    expect(el.querySelector('.opp-table thead th[aria-sort="descending"]')).not.toBeNull();
    const [first, second] = rows(el);
    expect(text(cells(first)[0])).toBe('1');
    expect(text(cells(first)[1].querySelector('a'))).toBe('2847 SW 27th Ter');
    expect(cells(first)[1].querySelector('a')!.getAttribute('href')).toBe('/property/42');
    expect(text(cells(first)[2].querySelector('.score-line'))).toBe('36.3');
    expect(text(cells(first)[2].querySelector('.cell-sub'))).toBe('Evidence covers 50 of 100');
    // Confidence in the one format (DESIGN.md §9): the factor's score with the band it states.
    expect(text(cells(first)[3])).toBe('$985,000 Confidence 78 of 100 · Medium');
    // Backend notes name no fields: coveragePercent is written in the page's words.
    expect(el.textContent).toContain('Evidence coverage is the highest score the available evidence allows.');
    expect(el.textContent).not.toContain('coveragePercent');
    expect(text(cells(first)[4])).toBe('+4.2%');
    // Strongest evidence: the factors that earned points, most first, as plain lines.
    expect([...cells(first)[5].querySelectorAll('li')].map((li) => text(li))).toEqual([
      'One-year forecast growth',
      'Valuation confidence',
    ]);
    // Missing values are Unavailable on the hatch, never 0, a dash or blank.
    expect(text(cells(second)[1].querySelector('a'))).toBe('Folio 01-4137-012-0450');
    expect(cells(second)[3].classList).toContain('na');
    expect(cells(second)[4].classList).toContain('na');
    expect(el.textContent).not.toMatch(/—|\bnull\b/);
    expect(el.textContent).toContain('2 scored properties');
    // The scoring version is a model string: only under Method (DESIGN.md §9), including the
    // backend note that names it.
    const outside = el.cloneNode(true) as HTMLElement;
    outside.querySelector('.opp-method')!.remove();
    expect(outside.textContent).not.toContain('opportunity-v1');
    expect(el.querySelector('.opp-method')!.textContent).toContain('Version opportunity-v1 scores');
    expect(el.querySelector('.opp-notes')!.textContent).toContain('Forecasts are model trend scenarios');
    // On phones the forecast column folds into the property cell, missing or not.
    expect([...cells(second)[1].querySelectorAll('.m-only')].map((x) => text(x))).toEqual([
      'ZentraValue unavailable',
      'Next 12 months unavailable',
    ]);
  });

  it('sorts on the server by the API’s orders from the column headers', async () => {
    const { fixture, el } = await setup(page([A, B]));
    const header = (name: string) =>
      [...el.querySelectorAll<HTMLElement>('.opp-table thead th')].find((th) => text(th).startsWith(name))!;
    header('ZentraValue').querySelector('button')!.click();
    fixture.detectChanges();
    expect(browses().at(-1)!.query).toMatchObject({ sort: 'VALUE_DESC', page: 0 });
    store.dispatch(O.browsed({ query: browses().at(-1)!.query, page: page([A, B]) }));
    fixture.detectChanges();
    header('ZentraValue').querySelector('button')!.click();
    fixture.detectChanges();
    expect(browses().at(-1)!.query.sort).toBe('VALUE_ASC');
    header('Next 12 months').querySelector('button')!.click();
    fixture.detectChanges();
    expect(browses().at(-1)!.query.sort).toBe('FORECAST_GROWTH_1Y_DESC');
    store.dispatch(O.browsed({ query: browses().at(-1)!.query, page: page([A, B]) }));
    fixture.detectChanges();
    // The forecast only sorts high to low: a second click asks for nothing and keeps the arrow down.
    const count = browses().length;
    header('Next 12 months').querySelector('button')!.click();
    fixture.detectChanges();
    expect(browses()).toHaveLength(count);
    expect(header('Next 12 months').getAttribute('aria-sort')).toBe('descending');
  });

  it('says why the list is empty, with no zero count', async () => {
    const { el } = await setup(page([], 'NOT_SCORED'));
    expect(el.textContent).toContain('Opportunity scores have not been calculated yet.');
    expect(el.textContent).not.toContain('0 scored properties');
  });

  it('opens a row’s score and factors in the record pane, and steps through the page', async () => {
    const { fixture, el } = await setup(page([A, B]));
    cells(rows(el)[0])[2].click();
    fixture.detectChanges();
    const pane = el.querySelector('aside.desk-slot gz-record-pane')!;
    expect(pane).not.toBeNull();
    expect(text(pane.querySelector('h2'))).toBe('2847 SW 27th Ter');
    expect(text(pane.querySelector('.pane-pos'))).toBe('1 of 2 on this page');
    expect(text(pane.querySelector('.or-score'))).toBe('36.3 of 100');
    expect(pane.textContent).toContain('The evidence on record covers 50 of 100 points');
    // Every factor, the missing one hatched with its reason; never a zero-width bar.
    const factors = [...pane.querySelectorAll('gz-score-factors tbody tr')];
    expect(factors.map((r) => text(r.querySelector('.cell-main')))).toEqual([
      'One-year forecast growth',
      'Valuation confidence',
      'Rental yield',
    ]);
    expect(factors[2].querySelector('td.na .na-word')!.textContent).toBe('Unavailable');
    expect(factors[2].textContent).toContain('No rent estimate is stored');
    expect(pane.querySelector('a.btn')!.getAttribute('href')).toBe('/property/42');
    pane.querySelector<HTMLButtonElement>('[aria-label="Next property"]')!.click();
    fixture.detectChanges();
    const next = el.querySelector('aside.desk-slot gz-record-pane')!;
    expect(text(next.querySelector('h2'))).toBe('Folio 01-4137-012-0450');
    expect(next.textContent).toContain('Unavailable');
    next.querySelector<HTMLButtonElement>('.pane-close')!.click();
    fixture.detectChanges();
    expect(el.querySelector('aside.desk-slot')).toBeNull();
  });

  it('closes the pane when its record leaves the results', async () => {
    const { fixture, el } = await setup(page([A, B]));
    cells(rows(el)[1])[2].click();
    fixture.detectChanges();
    expect(el.querySelector('aside.desk-slot')).not.toBeNull();
    // A new filter: the answer for it no longer holds the open record.
    const query: OpportunityQuery = { page: 0, size: 12, sort: 'SCORE_DESC', minScore: 30 };
    store.dispatch(O.browse({ query }));
    store.dispatch(O.browsed({ query, page: page([A]) }));
    fixture.detectChanges();
    expect(el.querySelector('aside.desk-slot')).toBeNull();
    expect(TestBed.inject(ShellLayer).sheetOpen()).toBe(false);
  });

  it('sorts what is applied only: never the shared location picker or an unapplied field', async () => {
    const { fixture, el } = await setup(page([A, B]));
    // A county chosen elsewhere (Explore, Settings, the area form) and an invalid score typed here.
    store.dispatch(LocationsActions.selectState({ stateId: 12 }));
    store.dispatch(LocationsActions.selectCounty({ countyId: 17 }));
    const score = el.querySelector<HTMLInputElement>('#opp-min-score')!;
    score.value = '150';
    score.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const header = [...el.querySelectorAll<HTMLElement>('.opp-table thead th')].find((th) =>
      text(th).startsWith('ZentraValue'),
    )!;
    header.querySelector('button')!.click();
    fixture.detectChanges();
    expect(browses().at(-1)!.query).toEqual({ page: 0, size: 12, sort: 'VALUE_DESC' });
    await fixture.whenStable();
    fixture.detectChanges();
    const select = el.querySelector<HTMLSelectElement>('#opp-sort')!;
    expect(select.value).toBe('VALUE_DESC');
    // The Sort select (phones) does the same.
    select.value = 'VALUE_ASC';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(browses().at(-1)!.query).toEqual({ page: 0, size: 12, sort: 'VALUE_ASC' });
  });

  it('clears the location picker with the other filters', async () => {
    const { fixture, el } = await setup(page([A, B]));
    store.dispatch(LocationsActions.selectState({ stateId: 12 }));
    store.dispatch(LocationsActions.selectCounty({ countyId: 17 }));
    for (const a of applied({ page: 0, size: 12, sort: 'VALUE_ASC', stateId: 12, countyId: 17, minScore: 20 }, page([A, B])))
      store.dispatch(a);
    fixture.detectChanges();
    const clear = [...el.querySelectorAll<HTMLButtonElement>('form button')].find((b) => text(b) === 'Clear filters')!;
    clear.click();
    fixture.detectChanges();
    expect(dispatched).toContainEqual(LocationsActions.selectState({ stateId: null }));
    expect(browses().at(-1)!.query).toEqual({ page: 0, size: 12, sort: 'SCORE_DESC' });
  });

  it('says how many match the filters, with the verb agreeing', async () => {
    const { fixture, el } = await setup(page([A, B]));
    for (const a of applied({ page: 0, size: 12, sort: 'SCORE_DESC', minScore: 30 }, page([A]))) store.dispatch(a);
    fixture.detectChanges();
    expect(text(el.querySelector('.opp-count'))).toBe('1 scored property matches these filters');
  });

  it('follows the selection with the arrow keys, opens on Enter, and gives focus back on Escape', async () => {
    const { fixture, el } = await setup(page([A, B]));
    const key = (target: HTMLElement, k: string) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    key(rows(el)[0], 'Enter');
    fixture.detectChanges();
    expect(text(el.querySelector('aside.desk-slot h2'))).toBe('2847 SW 27th Ter');
    key(rows(el)[0], 'ArrowDown');
    fixture.detectChanges();
    expect(text(el.querySelector('aside.desk-slot h2'))).toBe('Folio 01-4137-012-0450');
    expect(document.activeElement).toBe(rows(el)[1]);
    key(rows(el)[1], 'Escape');
    fixture.detectChanges();
    TestBed.tick();
    expect(el.querySelector('aside.desk-slot')).toBeNull();
    expect(document.activeElement).toBe(rows(el)[1]);
  });

  it('keeps focus in the pane when Next reaches the last record', async () => {
    const { fixture, el } = await setup(page([A, B]));
    cells(rows(el)[0])[2].click();
    fixture.detectChanges();
    const next = el.querySelector<HTMLButtonElement>('[aria-label="Next property"]')!;
    next.focus();
    next.click();
    fixture.detectChanges();
    TestBed.tick();
    expect(next.disabled).toBe(true);
    expect(document.activeElement).toBe(el.querySelector('[aria-label="Previous property"]'));
  });

  it('leaves the pane closed after switching tabs and back', async () => {
    const { fixture, el } = await setup(page([A, B]));
    cells(rows(el)[0])[2].click();
    fixture.detectChanges();
    expect(el.querySelector('aside.desk-slot')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('#opp-tab-matches')!.click();
    fixture.detectChanges();
    expect(el.querySelector('aside.desk-slot')).toBeNull();
    el.querySelector<HTMLButtonElement>('#opp-tab-scored')!.click();
    fixture.detectChanges();
    expect(el.querySelector('aside.desk-slot')).toBeNull();
  });

  it('numbers the ranks across pages and closes the pane when the page changes', async () => {
    const two = (content: OpportunityItem[], n: number): OpportunityPageDTO => ({
      ...page(content),
      results: { content, page: n, size: 12, totalElements: 14, totalPages: 2 },
    });
    const { fixture, el } = await setup(two([A, B], 0));
    cells(rows(el)[1])[2].click();
    fixture.detectChanges();
    expect(el.querySelector('aside.desk-slot')).not.toBeNull();
    [...el.querySelectorAll<HTMLButtonElement>('.pager button')].find((b) => text(b) === 'Next')!.click();
    const query = browses().at(-1)!.query;
    expect(query.page).toBe(1);
    store.dispatch(O.browsed({ query, page: two([opportunity({ propertyId: 60 }), opportunity({ propertyId: 61 })], 1) }));
    fixture.detectChanges();
    expect(rows(el).map((r) => text(cells(r)[0]))).toEqual(['13', '14']);
    expect(el.querySelector('aside.desk-slot')).toBeNull();
  });

  it('writes out why each value of the pane is missing, and shows no estimate without its range', async () => {
    const C = opportunity({
      propertyId: 70,
      valuationDataThrough: null,
      valuationRunId: null,
      factors: [factor({}), RENT],
    });
    const { fixture, el } = await setup(page([C]));
    cells(rows(el)[0])[2].click();
    fixture.detectChanges();
    const pane = el.querySelector('aside.desk-slot')!;
    const reasons = [...pane.querySelectorAll('.record-row .na-why')].map((x) => text(x));
    expect(reasons).toEqual([
      "Opportunity scores don't store the range. The property record shows the estimate with its range and confidence.",
      "The score's valuation-confidence factor has no value.",
      "The valuation's data date was not stored with this score.",
      'Not stored with this score.',
    ]);
    expect(pane.textContent).not.toContain('Not stated');
  });

  it('opens the matches tab from the address and leaves the scored list alone', async () => {
    const { el } = await setup(null, 'matches');
    expect(el.querySelector('[role=tab][aria-selected=true]')!.id).toBe('opp-tab-matches');
    expect(el.querySelector('gz-matches')).not.toBeNull();
    expect(browses()).toHaveLength(0);
    expect(dispatched.filter((a) => a.type === RecommendationsActions.load.type)).toHaveLength(1);
  });

  it('describes the rows on screen, not a filter or sort that failed, and Retry asks again', async () => {
    const { fixture, el } = await setup(page([A, B]));
    const header = (name: string) =>
      [...el.querySelectorAll<HTMLElement>('.opp-table thead th')].find((th) => text(th).startsWith(name))!;
    // A minimum score that fails: the rows loaded before stay, and so does their own count.
    store.dispatch(O.browse({ query: { page: 0, size: 12, sort: 'SCORE_DESC', minScore: 60 } }));
    store.dispatch(O.browseFailed({ error: 'x' }));
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')!.textContent).toContain('These are the ones loaded before.');
    expect(text(el.querySelector('.opp-count'))).toBe('2 scored properties');
    // A sort that fails: the column still shows the order of the rows.
    store.dispatch(O.browse({ query: { page: 0, size: 12, sort: 'VALUE_ASC' } }));
    store.dispatch(O.browseFailed({ error: 'x' }));
    fixture.detectChanges();
    expect(header('Score').getAttribute('aria-sort')).toBe('descending');
    expect(header('ZentraValue').getAttribute('aria-sort')).toBeNull();
    // Retry asks again for what failed; it goes with its alert, so focus moves to the count.
    const retry = [...el.querySelectorAll<HTMLButtonElement>('[role=alert] button')][0];
    retry.focus();
    retry.click();
    fixture.detectChanges();
    expect(browses().at(-1)!.query).toEqual({ page: 0, size: 12, sort: 'VALUE_ASC' });
    expect(document.activeElement).toBe(el.querySelector('.opp-count'));
    store.dispatch(O.browsed({ query: browses().at(-1)!.query, page: page([B, A]) }));
    fixture.detectChanges();
    expect(header('ZentraValue').getAttribute('aria-sort')).toBe('ascending');
    expect(document.activeElement).toBe(el.querySelector('.opp-count'));
  });

  it('moves focus to the results when the empty table’s Clear filters goes away', async () => {
    const { fixture, el } = await setup(page([A, B]));
    for (const a of applied({ page: 0, size: 12, sort: 'SCORE_DESC', minScore: 90 }, page([]))) store.dispatch(a);
    fixture.detectChanges();
    const clear = [...el.querySelectorAll<HTMLButtonElement>('tbody button')].find(
      (b) => text(b) === 'Clear filters',
    )!;
    clear.focus();
    clear.click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(el.querySelector('.opp-count'));
    store.dispatch(O.browsed({ query: browses().at(-1)!.query, page: page([A, B]) }));
    fixture.detectChanges();
    expect(el.querySelector('tbody button')).toBeNull();
    expect(document.activeElement).toBe(el.querySelector('.opp-count'));
  });

  it('asks for the scored results again when they were reset while still an investor, instead of going blank', async () => {
    const { fixture, el } = await setup(page([A, B]));
    expect(browses()).toHaveLength(0);
    // Every slice is reset (sign-out elsewhere, a failed token refresh); the account is an investor again.
    store.dispatch(UserActions.signedOut());
    actAs(store, 'investor');
    fixture.detectChanges();
    expect(browses().map((a) => a.query)).toEqual([{ page: 0, size: 12, sort: 'SCORE_DESC' }]);
    expect(el.querySelectorAll('.row-skeleton').length).toBeGreaterThan(0);
  });

  it('offers only Matched to you without the investment feature, and asks for no scored results', async () => {
    const { fixture, el } = await setup(page([A, B]));
    // Signed out: every slice is reset, the entitlements with it.
    store.dispatch(UserActions.signedOut());
    fixture.detectChanges();
    expect([...el.querySelectorAll('[role=tab]')].map((t) => t.textContent!.trim())).toEqual(['Matched to you']);
    expect(browses()).toHaveLength(0);
  });
});

describe('Opportunity rows', () => {
  it('writes signed percentages with a true minus, and nothing for a missing figure', () => {
    expect(signedPercent(4.2)).toBe('+4.2%');
    expect(signedPercent(-1.4)).toBe('−1.4%');
    expect(signedPercent(null)).toBe('');
    expect(signedPercent(-0.04)).toBe('0.0%');
  });
  it('reads the confidence from the score’s own factor, or says none was stated', () => {
    expect(confidenceText(A)).toBe('Confidence 78 of 100 · Medium');
    expect(confidenceText(B)).toBe('Confidence not stated');
    // No band in the explanation: the score alone, never a band worked out from it.
    const withExplanation = (explanation: string) =>
      opportunity({ factors: [factor({ ...CONFIDENCE, explanation })] });
    expect(confidenceText(withExplanation('The score is 78 of 100.'))).toBe('Confidence 78 of 100');
    const low = withExplanation("The valuation's confidence score is 40 of 100 (low confidence).");
    expect(confidenceLow(low)).toBe(true);
    expect(confidenceLow(A)).toBe(false);
  });
  it('names a row by address, else by folio', () => {
    expect(opportunityTitle(A)).toBe('2847 SW 27th Ter');
    expect(opportunityTitle({ address: null, folio: null })).toBe('Address unavailable');
  });
  it('lists only factors that earned points, most first', () => {
    expect(strongestFactors(A)).toEqual(['One-year forecast growth', 'Valuation confidence']);
  });
  it('maps the table’s columns to the API’s four orders', () => {
    expect(sortFromColumn({ key: 'value', dir: 'asc' })).toBe('VALUE_ASC');
    expect(sortFromColumn({ key: 'value', dir: 'desc' })).toBe('VALUE_DESC');
    expect(sortFromColumn({ key: 'forecast', dir: 'asc' })).toBe('FORECAST_GROWTH_1Y_DESC');
    expect(sortFromColumn({ key: 'score', dir: 'asc' })).toBe('SCORE_DESC');
    expect(sortFromColumn(null)).toBe('SCORE_DESC');
  });
});
