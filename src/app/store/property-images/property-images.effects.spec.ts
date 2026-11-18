import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '..';
import { PropertyImagesActions as A } from './property-images.actions';
import { selectPropertyImages } from './property-images.selectors';
describe('Property image loading', () => {
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
  it('cancels previous property requests and clears photos when the dialog closes', () => {
    const state = store.selectSignal(selectPropertyImages);
    store.dispatch(A.load({ propertyId: 42 }));
    const first = http.expectOne((r) => r.url.endsWith('/images/property/42'));
    store.dispatch(A.load({ propertyId: 43 }));
    expect(first.cancelled).toBe(true);
    expect(state().images).toEqual([]);
    const second = http.expectOne((r) => r.url.endsWith('/images/property/43'));
    store.dispatch(A.clear());
    expect(second.cancelled).toBe(true);
    expect(state().loading).toBe(false);
    expect(state().propertyId).toBeNull();
  });
  it('recovers from image API failures without blocking property details', () => {
    const state = store.selectSignal(selectPropertyImages);
    store.dispatch(A.load({ propertyId: 42 }));
    http
      .expectOne((r) => r.url.endsWith('/images/property/42'))
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    expect(state().loading).toBe(false);
    expect(state().error).toBeTruthy();
    store.dispatch(A.load({ propertyId: 42 }));
    http.expectOne((r) => r.url.endsWith('/images/property/42')).flush([]);
    expect(state().error).toBeNull();
    expect(state().images).toEqual([]);
  });
});
