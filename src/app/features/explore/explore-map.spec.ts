import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../../store';
import { ExploreMapActions } from '../../store/explore-map/explore-map.actions';
import { PropertySearchItem } from '../../core/models/api';
import { Placement } from '../../shared/data/parcel-geometry';
import { ExploreMap } from './explore-map';

const row = (id: number, folio: string, address: string | null): PropertySearchItem => ({
  id,
  folio,
  countyId: 1,
  countyName: 'Miami-Dade',
  stateCode: 'FL',
  stateName: 'Florida',
  address,
  city: 'Miami',
  zip: '33133',
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
const HOUSE = row(42, '0141370120450', '2847 SW 27th Ter');
const NEIGHBOUR = row(43, '0141370120460', '2861 SW 27th Ter');
const UNIT = row(46, '0232060011504', '1700 Collins Ave, Unit 1504');
const place = (x: number): Placement => ({
  point: [25.75, x],
  geom: {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [x, 25.75],
          [x + 0.0002, 25.75],
          [x + 0.0002, 25.7502],
          [x, 25.7502],
          [x, 25.75],
        ],
      ],
    ],
  },
});

describe('Explore map', () => {
  let store: Store;
  let http: HttpTestingController;
  function setup(rows: PropertySearchItem[] = [HOUSE, NEIGHBOUR, UNIT]) {
    TestBed.configureTestingModule({
      imports: [ExploreMap],
      providers: [provideHttpClient(), provideHttpClientTesting(), ...provideTestStore()],
    });
    store = TestBed.inject(Store);
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ExploreMap);
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const legend = () => el.querySelector('.em-legend')!.textContent!.replace(/\s+/g, ' ');
    return { fixture, el, legend };
  }
  const placing = (...rows: PropertySearchItem[]) =>
    ExploreMapActions.placeProperties({
      targets: rows.map((r) => ({ propertyId: r.id, folio: r.folio, countyId: r.countyId })),
    });

  it('asks for a state before there are results', () => {
    const { legend } = setup([]);
    expect(legend()).toContain('Choose a state to see its properties on the map.');
  });

  it('counts what is placed and names what has no boundary on record', () => {
    const { fixture, el, legend } = setup();
    store.dispatch(placing(HOUSE, NEIGHBOUR, UNIT));
    fixture.detectChanges();
    expect(el.textContent).toContain('Placing properties on the map');
    store.dispatch(ExploreMapActions.placementFound({ propertyId: HOUSE.id, placement: place(-80.24) }));
    store.dispatch(
      ExploreMapActions.placementFound({ propertyId: NEIGHBOUR.id, placement: place(-80.2397) }),
    );
    store.dispatch(ExploreMapActions.placementFound({ propertyId: UNIT.id, placement: null }));
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Placing properties on the map');
    expect(legend()).toContain('2 of 3 properties on this page are on the map.');
    expect(legend()).toContain(
      'Not on the map: 1700 Collins Ave, Unit 1504. No parcel boundary is on record.',
    );
  });

  it('says when lookups failed, without calling them "no boundary", and Retry looks them up again', () => {
    const { fixture, el, legend } = setup();
    store.dispatch(placing(HOUSE, NEIGHBOUR, UNIT));
    const sent = http.match((r) => r.url.endsWith('/parcels/byfolio'));
    sent[0].flush([]); // no usable geometry: no boundary on record
    sent[1].flush({}, { status: 503, statusText: 'Unavailable' });
    sent[2].flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(legend()).toContain('2 properties could not be placed.');
    expect(legend()).toContain('Not on the map: 2847 SW 27th Ter. No parcel boundary is on record.');
    expect(legend()).not.toContain('Unit 1504. No parcel boundary');
    [...el.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Retry')!.click();
    const again = http.match((r) => r.url.endsWith('/parcels/byfolio'));
    expect(again.map((r) => r.request.params.get('folio'))).toEqual([NEIGHBOUR.folio, UNIT.folio]);
    again[0].flush([{ id: 1, folio: NEIGHBOUR.folio, propertyId: NEIGHBOUR.id, countyId: 1, stateCode: 'FL', lotSize: 1, geom: place(-80.2397).geom }]);
    again[1].flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(legend()).not.toContain('could not be placed');
    expect(legend()).toContain('1 of 3 properties on this page is on the map.');
  });

  it('says when the values failed instead of showing every pin as "No ZentraValue"', () => {
    const { fixture, legend } = setup([HOUSE]);
    fixture.componentRef.setInput('valuesStatus', 'error');
    store.dispatch(placing(HOUSE));
    store.dispatch(ExploreMapActions.placementFound({ propertyId: HOUSE.id, placement: place(-80.24) }));
    fixture.detectChanges();
    expect(legend()).toContain('ZentraValues could not load, so the pins show no values.');
    expect(legend()).toContain('The property on this page is on the map.');
  });

  it('is a named map region, since Leaflet makes it a tab stop', () => {
    const { el } = setup();
    const map = el.querySelector('.em-map')!;
    expect(map.hasAttribute('aria-hidden')).toBe(false);
    expect(map.getAttribute('role')).toBe('region');
    expect(map.getAttribute('aria-label')).toBe('Map');
  });
});
