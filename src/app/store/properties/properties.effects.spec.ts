import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '..';
import { PropertiesActions as A } from './properties.actions';
import { selectProperties } from './properties.selectors';
import { ValuationActions as V } from '../valuation/valuation.actions';
import { selectValuation } from '../valuation/valuation.selectors';
describe('API effect recovery', () => {
  let store: Store;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ...provideTestStore()],
    });
    store = TestBed.inject(Store);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('clears parcel loading on failure and allows a subsequent request', () => {
    const state = store.selectSignal(selectProperties);
    store.dispatch(A.loadParcels({ bbox: 'first' }));
    http
      .expectOne((r) => r.params.get('bbox') === 'first')
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    expect(state().loading).toBe(false);
    expect(state().error).toBeTruthy();
    store.dispatch(A.loadParcels({ bbox: 'retry' }));
    http.expectOne((r) => r.params.get('bbox') === 'retry').flush([]);
    expect(state().error).toBeNull();
    expect(state().loading).toBe(false);
  });
  it('cancels stale viewport requests when the map clears parcels', () => {
    store.dispatch(A.loadParcels({ bbox: 'old' }));
    const request = http.expectOne((r) => r.params.get('bbox') === 'old');
    store.dispatch(A.clearParcels());
    expect(request.cancelled).toBe(true);
    expect(store.selectSignal(selectProperties)().parcels).toEqual([]);
  });
  const card = (id: number, folio: string, countyId: number) => ({
    id,
    folio,
    countyId,
    address: folio + ' Oak Ave',
    countyName: null,
    stateCode: null,
    stateName: null,
    city: null,
    zip: null,
    dorCode: null,
    propertyType: null,
    bedrooms: null,
    bathrooms: null,
    livingAreaSqft: null,
    lotSize: null,
    yearBuilt: null,
    neighborhood: null,
    neighborhoodDescription: null,
  });
  const parcel = (folio: string, countyId: number) => ({
    id: 1,
    folio,
    propertyId: 1,
    countyId,
    stateCode: 'FL',
    lotSize: 0,
    geom: { type: 'MultiPolygon' as const, coordinates: [] },
  });
  it('draws the first address match by fetching its boundary with folio and county', () => {
    const state = store.selectSignal(selectProperties);
    store.dispatch(A.search({ query: { mode: 'address', value: 'Oak Ave' } }));
    http
      .expectOne((r) => r.url.endsWith('/addresses/search'))
      .flush([card(1, '000111', 17), card(2, '000222', 23)]);
    expect(state().addressMatches.length).toBe(2);
    expect(state().loading).toBe(true);
    http.expectOne((r) => r.url.endsWith('/images/property/1')).flush([]);
    http.expectOne((r) => r.url.endsWith('/images/property/2')).flush([]);
    const boundary = http.expectOne((r) => r.url.endsWith('/parcels/byfolio'));
    expect(boundary.request.params.get('folio')).toBe('000111');
    expect(boundary.request.params.get('countyId')).toBe('17');
    boundary.flush([parcel('000111', 17)]);
    expect(state().loading).toBe(false);
    expect(state().searchFolio).toBe('000111');
    expect(state().parcels.length).toBe(1);
    store.dispatch(A.chooseMatch({ match: card(2, '000222', 23) }));
    const second = http.expectOne((r) => r.url.endsWith('/parcels/byfolio'));
    expect(second.request.params.get('countyId')).toBe('23');
    second.flush([]);
    expect(state().parcels).toEqual([]);
    expect(state().searchNotice).toContain('No parcel boundary');
  });
  it('treats an address with no match as a notice rather than an outage', () => {
    const state = store.selectSignal(selectProperties);
    store.dispatch(A.search({ query: { mode: 'address', value: 'Nowhere' } }));
    http
      .expectOne((r) => r.url.endsWith('/addresses/search'))
      .flush('No property found', { status: 404, statusText: 'Not Found' });
    expect(state().loading).toBe(false);
    expect(state().error).toBeNull();
    expect(state().searchNotice).toContain('No property was found');
  });
  it('passes the clicked property county to detail requests', () => {
    store.dispatch(A.loadDetail({ folio: '000123', countyId: 23 }));
    const request = http.expectOne((r) => r.url.endsWith('/properties/000123'));
    expect(request.request.params.get('countyId')).toBe('23');
    request.flush({ folio: '000123', countyId: 23 });
    expect(store.selectSignal(selectProperties)().detail?.countyId).toBe(23);
  });
  it('caches identical folios separately for different counties', () => {
    store.dispatch(A.loadDetail({ folio: '000123', countyId: 17 }));
    http
      .expectOne((r) => r.params.get('countyId') === '17')
      .flush({ folio: '000123', countyId: 17 });
    store.dispatch(A.loadDetail({ folio: '000123', countyId: 23 }));
    http
      .expectOne((r) => r.params.get('countyId') === '23')
      .flush({ folio: '000123', countyId: 23 });
    const state = store.selectSignal(selectProperties)();
    expect(state.entities['17:000123']?.countyId).toBe(17);
    expect(state.entities['23:000123']?.countyId).toBe(23);
  });
  it('clears prediction loading without hiding property detail errors', () => {
    store.dispatch(V.load({ propertyId: 42 }));
    http
      .expectOne((r) => r.params.get('propertyId') === '42')
      .flush('Unavailable', { status: 500, statusText: 'Unavailable' });
    expect(store.selectSignal(selectValuation)().loading).toBe(false);
    expect(store.selectSignal(selectValuation)().error).toBeTruthy();
  });
});
