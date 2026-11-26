import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '..';
import { SessionEvents } from '../../core/auth/session-events';
import { UserActions } from '../user/user.actions';
import { ExploreMapActions as A, PlaceTarget } from './explore-map.actions';
import { selectExploreMap } from './explore-map.selectors';

const target = (id: number): PlaceTarget => ({
  propertyId: id,
  folio: String(1_000_000_000_000 + id),
  countyId: 1,
});
const square = [
  [
    [
      [-80.24, 25.75],
      [-80.2398, 25.75],
      [-80.2398, 25.7502],
      [-80.24, 25.7502],
      [-80.24, 25.75],
    ],
  ],
];
const parcel = (id: number) => ({
  id: 90000 + id,
  folio: target(id).folio,
  propertyId: id,
  countyId: 1,
  stateCode: 'FL',
  lotSize: 6000,
  geom: { type: 'MultiPolygon', coordinates: square },
});
const ids = (...n: number[]) => n.map(target);

describe('Explore map placements', () => {
  let http: HttpTestingController;
  let store: Store;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ...provideTestStore()],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(Store);
  });
  /** Lookups sent and still open (a cancelled request is not one). */
  const lookups = () =>
    http.match((r) => r.url.endsWith('/parcels/byfolio')).filter((r) => !r.cancelled);
  const folioOf = (r: { request: { params: { get(k: string): string | null } } }) =>
    r.request.params.get('folio');
  const state = () => store.selectSignal(selectExploreMap)();

  it('looks results up by folio and county, four at a time, and never twice', () => {
    store.dispatch(A.placeProperties({ targets: ids(1, 2, 3, 4, 5, 6) }));
    // Asked again while they run: nothing is restarted or doubled.
    store.dispatch(A.placeProperties({ targets: ids(1, 2, 3, 4, 5, 6) }));
    const first = lookups();
    expect(first.map(folioOf)).toEqual(ids(1, 2, 3, 4).map((t) => t.folio));
    expect(first[0].request.params.get('countyId')).toBe('1');
    expect(state().placing).toEqual([1, 2, 3, 4, 5, 6]);
    first.forEach((r, i) => r.flush([parcel(i + 1)]));
    const rest = lookups();
    expect(rest.map(folioOf)).toEqual(ids(5, 6).map((t) => t.folio));
    rest.forEach((r, i) => r.flush([parcel(i + 5)]));
    expect(state().placing).toEqual([]);
    expect(Object.keys(state().placements)).toHaveLength(6);
    expect(state().placements[1]!.point[0]).toBeCloseTo(25.7501, 4);
    // Placed already: a later page that repeats a property doesn't look it up again.
    store.dispatch(A.placeProperties({ targets: ids(1) }));
    expect(lookups()).toHaveLength(0);
  });

  it('drops what is still pending for a page the user has left', () => {
    store.dispatch(A.placeProperties({ targets: ids(1, 2, 3, 4, 5, 6) }));
    const old = http.match((r) => r.url.endsWith('/parcels/byfolio'));
    expect(old).toHaveLength(4);
    store.dispatch(A.placeProperties({ targets: ids(7, 8) }));
    expect(old.every((r) => r.cancelled)).toBe(true);
    const next = lookups();
    expect(next.map(folioOf)).toEqual(ids(7, 8).map((t) => t.folio));
    expect(state().placing).toEqual([7, 8]);
    next.forEach((r, i) => r.flush([parcel(i + 7)]));
    // Nothing of the old page is left pending, failed or wrongly marked as having no boundary.
    expect(state()).toMatchObject({ placing: [], failed: [] });
    expect(Object.keys(state().placements)).toEqual(['7', '8']);
  });

  it('records "no boundary" for a 404 only, and retries any other failure', () => {
    store.dispatch(A.placeProperties({ targets: ids(1, 2) }));
    const [missing, broken] = lookups();
    missing.flush({ message: 'No parcel boundary is on record.' }, { status: 404, statusText: 'Not Found' });
    broken.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(state().placements[1]).toBeNull();
    expect(2 in state().placements).toBe(false);
    expect(state().failed).toEqual([2]);
    store.dispatch(A.placeProperties({ targets: ids(1, 2) }));
    const again = lookups();
    expect(again.map(folioOf)).toEqual([target(2).folio]);
    expect(state().failed).toEqual([]);
    again[0].flush([parcel(2)]);
    expect(state().placements[2]).not.toBeNull();
  });

  it('starts over cleanly when the session ends during a placement', () => {
    store.dispatch(A.placeProperties({ targets: ids(1, 2, 3, 4, 5, 6) }));
    expect(lookups()).toHaveLength(4);
    // Sign-out elsewhere, or a failed token refresh: work in flight is dropped, the slices reset.
    TestBed.inject(SessionEvents).end();
    store.dispatch(UserActions.signedOut());
    expect(lookups()).toHaveLength(0);
    expect(state()).toEqual({ placements: {}, placing: [], failed: [] });
    // The same page later: every property is looked up again, nothing is held back.
    store.dispatch(A.placeProperties({ targets: ids(1, 2, 3, 4, 5, 6) }));
    expect(lookups().map(folioOf)).toEqual(ids(1, 2, 3, 4).map((t) => t.folio));
  });
});
