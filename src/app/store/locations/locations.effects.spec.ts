import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '..';
import { LocationsActions as A } from './locations.actions';
import { selectLocations } from './locations.selectors';
describe('County selection', () => {
  it('clears the county and cancels stale county lists when switching states', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ...provideTestStore()],
    });
    const store = TestBed.inject(Store),
      http = TestBed.inject(HttpTestingController),
      state = store.selectSignal(selectLocations);
    store.dispatch(A.selectState({ stateId: 1 }));
    const previous = http.expectOne((r) => r.params.get('stateId') === '1');
    store.dispatch(A.selectCounty({ countyId: 17 }));
    store.dispatch(A.selectState({ stateId: 2 }));
    expect(previous.cancelled).toBe(true);
    expect(state().countyId).toBeNull();
    http
      .expectOne((r) => r.params.get('stateId') === '2')
      .flush([
        { countyId: 23, countyName: 'Other county', stateCode: 'XX', stateName: 'Other state' },
      ]);
    expect(state().counties[0].countyId).toBe(23);
    http.verify();
  });
});
