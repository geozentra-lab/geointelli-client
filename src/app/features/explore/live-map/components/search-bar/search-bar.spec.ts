import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTestStore } from '../../../../../store';
import { SearchBar } from './search-bar';
import { Store } from '@ngrx/store';
import { LocationsActions } from '../../../../../store/locations/locations.actions';
import { selectLocations } from '../../../../../store/locations/locations.selectors';
describe('Parcel search', () => {
  let store: Store;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SearchBar],
      providers: [provideHttpClient(), provideHttpClientTesting(), ...provideTestStore()],
    });
    store = TestBed.inject(Store);
    http = TestBed.inject(HttpTestingController);
  });
  const key = (name: string) => new KeyboardEvent('keydown', { key: name, cancelable: true });
  it('preserves the folio search contract', () => {
    const search = TestBed.createComponent(SearchBar).componentInstance;
    search.countyId.set(17);
    let result: unknown;
    search.search.subscribe((query) => (result = query));
    search.value.set('  0123456789  ');
    search.submit();
    expect(result).toEqual({ mode: 'folio', value: '0123456789', countyId: 17 });
  });
  it('keeps its county choice local to the map, seeded from the Explore selection', () => {
    store.dispatch(LocationsActions.selectState({ stateId: 3 }));
    http
      .expectOne((r) => r.url.endsWith('/locations/counties'))
      .flush([{ countyId: 17, countyName: 'Dade', stateCode: 'FL', stateName: 'Florida' }]);
    store.dispatch(LocationsActions.selectCounty({ countyId: 17 }));
    const fixture = TestBed.createComponent(SearchBar);
    fixture.detectChanges();
    const search = fixture.componentInstance;
    // The shared state list is still loaded through the store; only the selection is local.
    http.expectOne((r) => r.url.endsWith('/locations/states')).flush([]);
    expect(search.stateId()).toBe(3);
    expect(search.countyId()).toBe(17);
    expect(search.counties().map((c) => c.countyId)).toEqual([17]);
    search.selectState(5);
    const counties = http.expectOne((r) => r.url.endsWith('/locations/counties'));
    expect(counties.request.params.get('stateId')).toBe('5');
    counties.flush([{ countyId: 99, countyName: 'Other', stateCode: 'GA', stateName: 'Georgia' }]);
    search.countyId.set(99);
    const shared = store.selectSignal(selectLocations)();
    expect(shared.stateId).toBe(3);
    expect(shared.countyId).toBe(17);
    http.verify();
  });
  const card = (id: number, address: string | null) => ({
    id,
    folio: '00' + id,
    countyId: 17,
    countyName: 'Miami-Dade',
    stateCode: 'FL',
    stateName: 'Florida',
    address,
    city: 'Miami',
    zip: '33101',
    dorCode: null,
    propertyType: null,
    bedrooms: 3,
    bathrooms: 2,
    livingAreaSqft: 1450,
    lotSize: null,
    yearBuilt: null,
    neighborhood: null,
    neighborhoodDescription: null,
  });
  const pause = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));
  const typeAddress = (
    fixture: ReturnType<typeof TestBed.createComponent<SearchBar>>,
    text: string,
  ) => {
    const search = fixture.componentInstance;
    search.switchMode('address');
    search.onInput(text);
    fixture.detectChanges();
  };
  it('waits for three characters and a pause before looking up properties', async () => {
    const fixture = TestBed.createComponent(SearchBar);
    fixture.detectChanges();
    http.match((r) => r.url.endsWith('/locations/states')).forEach((r) => r.flush([]));
    typeAddress(fixture, 'Oa');
    await pause();
    http.expectNone((r) => r.url.endsWith('/addresses/search'));
    fixture.componentInstance.onInput('Oak');
    fixture.componentInstance.onInput('Oak A');
    http.expectNone((r) => r.url.endsWith('/addresses/search'));
    await pause();
    const request = http.expectOne((r) => r.url.endsWith('/addresses/search'));
    expect(request.request.params.get('rawAddress')).toBe('Oak A');
    request.flush([card(1, '1 Oak Ave')]);
    http.match((r) => r.url.includes('/images/property/')).forEach((r) => r.flush([]));
    expect(fixture.componentInstance.lookup().items.length).toBe(1);
  });
  it('shows photos when they load and a placeholder otherwise', async () => {
    const fixture = TestBed.createComponent(SearchBar);
    fixture.detectChanges();
    http.match((r) => r.url.endsWith('/locations/states')).forEach((r) => r.flush([]));
    typeAddress(fixture, 'Oak');
    await pause();
    http
      .expectOne((r) => r.url.endsWith('/addresses/search'))
      .flush([card(1, '1 Oak Ave'), card(2, '2 Oak Ave')]);
    http
      .expectOne((r) => r.url.endsWith('/images/property/1'))
      .flush([
        { id: 9, storagePath: 'https://img.test/1.jpg', displayOrder: 0, primaryImage: true },
      ]);
    http.expectOne((r) => r.url.endsWith('/images/property/2')).flush([]);
    fixture.detectChanges();
    const options = fixture.nativeElement.querySelectorAll('[role="option"]');
    expect(options.length).toBe(2);
    expect(options[0].querySelector('img')?.getAttribute('src')).toBe('https://img.test/1.jpg');
    expect(options[1].querySelector('img')).toBeNull();
    expect(options[1].querySelector('.thumbnail')).toBeTruthy();
    expect(options[0].textContent).toContain('Miami · 33101 · Miami-Dade');
    expect(options[0].textContent).toContain('3 bd · 2 ba · 1,450 sqft');
  });
  it('lets the keyboard walk the cards and pick one with Enter', async () => {
    const fixture = TestBed.createComponent(SearchBar);
    fixture.detectChanges();
    http.match((r) => r.url.endsWith('/locations/states')).forEach((r) => r.flush([]));
    const search = fixture.componentInstance;
    typeAddress(fixture, 'Oak');
    await pause();
    http
      .expectOne((r) => r.url.endsWith('/addresses/search'))
      .flush([card(1, '1 Oak Ave'), card(2, '2 Oak St')]);
    http.match((r) => r.url.includes('/images/property/')).forEach((r) => r.flush([]));
    let picked: unknown;
    let searched: unknown;
    search.pick.subscribe((p) => (picked = p));
    search.search.subscribe((q) => (searched = q));
    expect(search.open()).toBe(true);
    expect(search.active()).toBe(-1);
    search.onKeydown(key('ArrowUp'));
    expect(search.active()).toBe(1);
    search.onKeydown(key('ArrowDown'));
    expect(search.active()).toBe(0);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[role="combobox"]');
    expect(input.getAttribute('aria-activedescendant')).toBe(search.optionId(0));
    search.onKeydown(key('Enter'));
    expect((picked as { id: number }).id).toBe(1);
    expect(searched).toBeUndefined();
    expect(search.value()).toBe('1 Oak Ave');
    expect(search.open()).toBe(false);
    // With nothing highlighted, Enter still runs a full address search for the typed text.
    search.onKeydown(key('Enter'));
    expect(searched).toEqual({ mode: 'address', value: '1 Oak Ave' });
  });
  it('treats a 404 as "no match" and offers a retry for real failures', async () => {
    const fixture = TestBed.createComponent(SearchBar);
    fixture.detectChanges();
    http.match((r) => r.url.endsWith('/locations/states')).forEach((r) => r.flush([]));
    typeAddress(fixture, 'Nowhere');
    await pause();
    http
      .expectOne((r) => r.url.endsWith('/addresses/search'))
      .flush('No property found', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    const list: HTMLElement = fixture.nativeElement.querySelector('[role="listbox"]');
    expect(list.textContent).toContain('No properties match that address.');
    expect(fixture.componentInstance.lookup().error).toBeNull();
    fixture.componentInstance.onInput('Nowhere 2');
    await pause();
    http
      .expectOne((r) => r.url.endsWith('/addresses/search'))
      .flush('Down', { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="listbox"] [role="alert"]')).toBeTruthy();
    fixture.componentInstance.retryLookup();
    await pause(20);
    http.expectOne((r) => r.url.endsWith('/addresses/search')).flush([]);
    expect(fixture.componentInstance.lookup().error).toBeNull();
  });
});
