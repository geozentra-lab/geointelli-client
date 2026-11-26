import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { Action, Store } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { ComparableDTO, ComparableResponse, PropertyComparison } from '../../core/models/api';
import { PropertyCompareActions } from '../../store/property-compare/property-compare.actions';
import { Compare } from './compare';
import { ComparableSales } from './comparable-sales';

const comparison = (id: number, over: Partial<PropertyComparison> = {}): PropertyComparison => ({
  propertyId: id,
  folio: '0141370120450',
  address: '2847 SW 27th Ter',
  countyName: 'Miami-Dade',
  stateCode: 'FL',
  facts: {
    bedrooms: 3,
    bathrooms: 2,
    livingAreaSqft: 1840,
    lotSizeSqft: 6250,
    yearBuilt: '1952',
    propertyType: 'Single family',
    floors: 1,
    units: 1,
  },
  assessment: { year: 2026, totalValue: 837000, landValue: 569000, buildingValue: 247370, assessedValue: 753000 },
  lastSale: { date: '2019-06-14', price: 612000 },
  valuation: {
    predictedPrice: 985000,
    low: 877000,
    high: 1093000,
    growthPercentage: 61,
    confidenceScore: 78,
    predictionDate: '2026-11-01',
  },
  scores: { schoolScore: 74, transportationScore: 68 },
  missingFields: [],
  ...over,
});
const comp = (rank: number, over: Partial<ComparableDTO['candidate']> = {}, missing: string[] = []): ComparableDTO => ({
  rank,
  candidate: {
    propertyId: 50 + rank,
    folio: '014137012047' + rank,
    countyId: 12,
    address: rank + '875 SW 27th Ter',
    city: 'Miami',
    zip: '33133',
    dorCode: '0101',
    bedrooms: 3,
    bathrooms: 2,
    livingAreaSqft: 1655,
    yearBuilt: '1953',
    saleId: 900 + rank,
    saleDate: '2026-06-21',
    salePrice: 905000,
    qualifiedFlag: 'Q',
    qualificationDescription: null,
    instrumentNumber: null,
    matchLevel: 'SAME_SUBDIVISION',
    distanceMeters: 160,
    ...over,
  },
  similarityScore: 0.84,
  evidenceCoveragePercent: 90,
  selectionReasons: ['Same subdivision', 'Sold 5 months ago'],
  missingData: missing,
  scoreBreakdown: {},
});
const sales = (over: Partial<ComparableResponse> = {}): ComparableResponse => ({
  propertyId: 42,
  subject: { propertyId: 42, countyId: 12, dorCode: '0101', bedrooms: 3, bathrooms: 2, livingAreaSqft: 1840, yearBuilt: '1952' },
  // Past years, so the dates keep their year whatever year the tests run in (DESIGN.md §13).
  asOfDate: '2025-11-14',
  saleDateFrom: '2023-11-14',
  search: { radiusMeters: 2012, months: 24, areaTolerancePercent: 25, bedroomTolerance: 1, limit: 20 },
  selectionVersion: 'comparable-selection-v3',
  rankingVersion: 'comparable-ranking-v2',
  candidatePoolLimit: 200,
  consideredCandidates: 5,
  candidatePoolLimitReached: false,
  minimumCandidates: 3,
  returnedCount: 2,
  status: 'COMPARABLES_FOUND',
  warnings: [],
  comparables: [comp(1), comp(2, { yearBuilt: null }, ['yearBuilt', 'someNewField'])],
  scoringWeights: { distance: 0.2, livingArea: 0.25 },
  ...over,
});

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Compare', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let dispatched: Action[];
  let el: HTMLElement;

  async function setup(url: string, before?: (store: Store) => void) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'compare', component: Compare },
          { path: 'compare/:id', component: Compare },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => true, hasRealmRole: () => false } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(Store);
    dispatched = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action) => {
      dispatched.push(a);
      return dispatch(a);
    }) as Store['dispatch']);
    before?.(store);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    el = harness.routeNativeElement!;
  }
  const compareRequests = () => http.match((r) => r.url.endsWith('/properties/compare'));
  const salesRequests = (id: number) =>
    http.match((r) => r.url.endsWith('/properties/id/' + id + '/comparables'));
  const url = () => TestBed.inject(Router).url;
  const settle = async () => {
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  const twoCompared = (ids: [number, number], warnings: string[] = []) => {
    const requests = compareRequests();
    expect(requests).toHaveLength(1);
    requests[0].flush({
      requestedIds: ids,
      comparedCount: 2,
      units: {},
      assessmentYear: 2026,
      warnings,
      properties: [comparison(ids[0]), comparison(ids[1], { address: '2861 SW 27th Ter' })],
    });
    harness.detectChanges();
  };
  const row = (label: string) =>
    [...el.querySelectorAll('.cp-table tbody tr')].find((tr) => text(tr.querySelector('th')) === label)!;
  const cells = (label: string) => [...row(label).querySelectorAll('td')];
  const tab = (name: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('[role=tab]')].find((b) => text(b) === name)!;

  it('names the page plainly and compares the properties from the address, field by field', async () => {
    await setup('/compare?ids=42,55');
    expect(text(el.querySelector('h1'))).toBe('Compare');
    expect(text(el.querySelector('.pagehead'))).not.toContain('Weigh');
    const requests = compareRequests();
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.request.body).toEqual({ propertyIds: [42, 55] });
    request.flush({
      requestedIds: [42, 55],
      comparedCount: 2,
      units: { currency: 'USD', area: 'sqft' },
      assessmentYear: 2026,
      warnings: ['1 of 2 properties has no published valuation.'],
      properties: [
        comparison(42),
        comparison(55, {
          address: null,
          folio: '0141370120380',
          facts: { ...comparison(55).facts!, bedrooms: null, bathrooms: 1 },
          valuation: null,
        }),
      ],
    });
    harness.detectChanges();

    expect([...el.querySelectorAll('.cp-table thead .cp-prop a')].map(text)).toEqual([
      '2847 SW 27th Ter',
      'Folio 01-4137-012-0380',
    ]);
    expect(text(el.querySelector('.cp-count'))).toBe('2 properties side by side');
    expect(text(el.querySelector('.cp-notes'))).toBe('1 of 2 properties has no published valuation.');
    // No ZentraValue for 55: one merged span over the group, with its reason written in it.
    const merged = el.querySelectorAll('td.cp-merged');
    expect(merged.length).toBe(1);
    expect(merged[0].getAttribute('rowspan')).toBe('5');
    expect(text(merged[0].querySelector('.na-word'))).toBe('Unavailable');
    expect(text(merged[0].querySelector('.na-why'))).toBe('No ZentraValue was returned for this property');
    // A missing fact: the marker, the reason for screen readers, and the footnote.
    expect(cells('Bedrooms')[1].classList).toContain('na');
    expect(text(cells('Bedrooms')[1])).toBe('Unavailable: Not in the county record');
    expect(text(el.querySelector('.cp-result'))).toContain('Unavailable facts are not in the county record.');
    // Figures as DESIGN.md writes them; the largest in a row says so in words.
    expect(text(cells('Bathrooms')[0])).toBe('2 Highest');
    expect(text(cells('Bathrooms')[1])).toBe('1');
    expect(text(cells('80% range')[0])).toBe('$877,000 to $1,093,000');
    expect(text(cells('Confidence')[0])).toBe('78 of 100');
    expect(text(cells('Change since last sale')[0])).toBe('+61.0%');
    expect(text(cells('School score')[0])).toBe('74 of 100');
    expect(text(cells('Date')[0])).toBe('Jun 14, 2019');
    expect(text(el.querySelector('.cp-table'))).not.toContain('—');
    // The chosen properties are rows with Remove, named, never "Property 55".
    expect([...el.querySelectorAll('.cp-remove')].map((b) => b.getAttribute('aria-label'))).toEqual([
      'Remove 2847 SW 27th Ter from the comparison',
      'Remove Folio 01-4137-012-0380 from the comparison',
    ]);
  });

  it('says why Compare waits, and an empty comparison says what will appear', async () => {
    await setup('/compare?ids=42');
    expect(compareRequests().length).toBe(0);
    const button = [...el.querySelectorAll<HTMLButtonElement>('.cp-actions button')].find(
      (b) => text(b) === 'Compare',
    )!;
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(text(el.querySelector('#cp-why'))).toBe('Choose one more property.');
    expect(button.getAttribute('aria-describedby')).toBe('cp-why');
    button.click();
    harness.detectChanges();
    expect(dispatched.some((a) => a.type === PropertyCompareActions.load.type)).toBe(false);
    expect(compareRequests().length).toBe(0);
    expect(text(el.querySelector('.cp-empty'))).toContain('Properties you compare appear here');

    // Removing the only property: its row goes and focus moves to the section's heading.
    document.body.appendChild(harness.fixture.nativeElement);
    el.querySelector<HTMLButtonElement>('.cp-remove')!.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(text(el.querySelector('.cp-none'))).toBe('No properties chosen.');
    expect(text(el.querySelector('#cp-why'))).toBe('Choose at least 2 properties.');
    expect(document.activeElement).toBe(el.querySelector('#cp-pick-title'));
    harness.fixture.nativeElement.remove();
  });

  it('keeps the tab in the address without running the comparison again', async () => {
    await setup('/compare?ids=42,43');
    twoCompared([42, 43]);
    expect(tab('Side by side').getAttribute('aria-selected')).toBe('true');
    tab('Comparable sales').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/compare?ids=42,43&view=sales');
    expect(tab('Comparable sales').getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector<HTMLElement>('#cp-panel-side')!.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('#cp-panel-sales')!.hidden).toBe(false);
    expect(text(el.querySelector('.cs-empty'))).toBe(
      'Choose a property by address to list the recorded sales most like it.',
    );
    expect(compareRequests().length).toBe(0);
    // Back to side by side: the comparison is still on screen.
    tab('Side by side').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/compare?ids=42,43');
    expect(el.querySelectorAll('.cp-table thead .cp-prop').length).toBe(2);
    expect(compareRequests().length).toBe(0);
  });

  it('lists the comparable sales of the property in the address, in miles and plain words', async () => {
    await setup('/compare/42');
    expect(tab('Comparable sales').getAttribute('aria-selected')).toBe('true');
    const requests = salesRequests(42);
    expect(requests).toHaveLength(1);
    const [request] = requests;
    // 1.25 miles, 24 months, the 20 most similar.
    expect(request.request.params.get('radiusMeters')).toBe('2012');
    expect(request.request.params.get('months')).toBe('24');
    expect(request.request.params.get('limit')).toBe('20');
    request.flush(sales());
    harness.detectChanges();

    const result = el.querySelector('.cs-result')!;
    expect(text(result.querySelector('h2'))).toBe('2 comparable sales');
    expect(text(result.querySelector('.cs-line'))).toBe(
      'Within 1.25 mi, sold since Nov 14, 2023, most similar first · records as of Nov 14, 2025',
    );
    const rows = [...result.querySelectorAll('.cs-table tbody tr')];
    expect(rows.length).toBe(2);
    // What a sale lacks, in words (a field this page doesn't know is left out); match as a percent.
    expect(text(rows[1])).toContain('Not on record: year built');
    expect(text(rows[1])).not.toContain('yearBuilt');
    expect(text(rows[1])).not.toContain('someNewField');
    expect(text(rows[0].querySelectorAll('td')[5])).toBe('84%');
    // 160 m is under a tenth of a mile.
    expect(text(rows[0].querySelectorAll('td')[4])).toBe('< 0.1');
    // Versions and weights only under Method (DESIGN.md §9, §13).
    const method = result.querySelector('details.cs-method')!;
    expect(text(method)).toContain('comparable-selection-v3');
    expect(text(method)).toContain('distance 20%, living area 25%');
    const prose = text(result).replace(text(method), '');
    expect(prose).not.toContain('comparable-selection-v3');
  });

  it('keeps the address in step with the selection, without running the comparison again', async () => {
    await setup('/compare?ids=42,43,44');
    const requests = compareRequests();
    expect(requests).toHaveLength(1);
    requests[0].flush({
      requestedIds: [42, 43, 44],
      comparedCount: 3,
      units: {},
      assessmentYear: 2026,
      warnings: ['1 of 3 properties has no published valuation.'],
      properties: [comparison(42), comparison(43), comparison(44, { valuation: null })],
    });
    harness.detectChanges();
    document.body.appendChild(harness.fixture.nativeElement);
    // Remove the first: focus moves to the Remove that takes its place.
    el.querySelectorAll<HTMLButtonElement>('.cp-remove')[0].click();
    await settle();
    expect(url()).toBe('/compare?ids=43,44');
    expect(compareRequests()).toHaveLength(0);
    expect(document.activeElement).toBe(el.querySelectorAll('.cp-remove')[0]);
    // The backend's notes counted the removed property: they are left out until Compare runs again.
    expect(el.querySelector('.cp-notes')).toBeNull();
    expect(text(el.querySelector('.cp-pending'))).toContain('1 property was removed after this comparison');
    expect(el.querySelectorAll('.cp-table thead .cp-prop').length).toBe(2);
    // Clear all empties the address too.
    [...el.querySelectorAll<HTMLButtonElement>('.cp-actions button')].find((b) => text(b) === 'Clear all')!.click();
    await settle();
    expect(url()).toBe('/compare');
    expect(compareRequests()).toHaveLength(0);
    harness.fixture.nativeElement.remove();
  });

  it('runs the comparison the compare tray links to, with that selection already chosen', async () => {
    await setup('/compare?ids=42,43', (store) =>
      store.dispatch(PropertyCompareActions.setSelection({ propertyIds: [42, 43] })),
    );
    twoCompared([42, 43]);
    expect(el.querySelectorAll('.cp-table thead .cp-prop').length).toBe(2);
    expect(url()).toBe('/compare?ids=42,43');
  });

  it('moves between the tabs with the arrow keys', async () => {
    await setup('/compare');
    document.body.appendChild(harness.fixture.nativeElement);
    tab('Side by side').focus();
    tab('Side by side').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle();
    expect(tab('Comparable sales').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('Comparable sales'));
    expect(url()).toBe('/compare?view=sales');
    tab('Comparable sales').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await settle();
    expect(tab('Side by side').getAttribute('aria-selected')).toBe('true');
    expect(url()).toBe('/compare');
    harness.fixture.nativeElement.remove();
  });

  it('searches the property in the address once, and follows the address to another', async () => {
    await setup('/compare/42');
    salesRequests(42)[0].flush(sales());
    harness.detectChanges();
    // Another tab and back: no new search.
    tab('Side by side').click();
    await settle();
    tab('Comparable sales').click();
    await settle();
    expect(salesRequests(42)).toHaveLength(0);
    // Another property in the address (the property page's Open in Compare): searched once.
    await harness.navigateByUrl('/compare/43');
    harness.detectChanges();
    expect(salesRequests(43)).toHaveLength(1);
    // One picked here goes into the address and is searched once.
    const sales43 = harness.fixture.debugElement.query(By.directive(ComparableSales))
      .componentInstance as ComparableSales;
    sales43.pick(44);
    await settle();
    expect(url()).toBe('/compare/43?property=44');
    expect(salesRequests(44)).toHaveLength(1);
  });

  it('says why a search cannot run, and what an empty answer means', async () => {
    await setup('/compare/42');
    http.match((r) => r.url.endsWith('/properties/id/42/comparables'))[0].flush(
      sales({ status: 'INSUFFICIENT_DATA', returnedCount: 0, comparables: [], warnings: [] }),
    );
    harness.detectChanges();
    expect(text(el.querySelector('.cs-status'))).toBe(
      'Not enough sales for a reliable comparison: at least 3 are needed.',
    );
    expect(text(el.querySelector('.cs-result h2'))).toBe('No comparable sales');
    expect(text(el.querySelector('.cs-none'))).toBe(
      'Nothing matched this search. A longer distance or sale history may find some.',
    );

    const miles = el.querySelector<HTMLInputElement>('#cs-miles')!;
    miles.value = '7';
    miles.dispatchEvent(new Event('input'));
    harness.detectChanges();
    expect(text(el.querySelector('#cs-why'))).toBe('Enter a distance from 0.1 to 6.2 miles.');
    el.querySelector<HTMLFormElement>('.cs-form')!.dispatchEvent(new Event('submit'));
    harness.detectChanges();
    expect(http.match((r) => r.url.endsWith('/properties/id/42/comparables')).length).toBe(0);
  });
});
