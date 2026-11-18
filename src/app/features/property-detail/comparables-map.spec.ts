import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { ComparablesMap } from './comparables-map';
import {
  compactPrice,
  geometryCentroid,
  metersToMiles,
  pricePerSqft,
} from './comparables-map.util';
import { ComparableDTO, ComparableResponse } from '../../core/models/api';

const square = (lon: number, lat: number, size = 0.001) => ({
  type: 'MultiPolygon' as const,
  coordinates: [
    [
      [
        [lon, lat],
        [lon + size, lat],
        [lon + size, lat + size],
        [lon, lat + size],
        [lon, lat],
      ],
    ],
  ],
});
const parcel = (folio: string, countyId: number, lon: number, lat: number) => ({
  id: 1,
  folio,
  propertyId: 1,
  countyId,
  stateCode: 'FL',
  lotSize: 0,
  geom: square(lon, lat),
});
const comp = (rank: number, id: number, folio: string, price: number): ComparableDTO => ({
  rank,
  similarityScore: 0.9 - rank / 100,
  evidenceCoveragePercent: 100,
  selectionReasons: ['Same property use', 'Similar living area'],
  missingData: [],
  scoreBreakdown: {},
  candidate: {
    propertyId: id,
    folio,
    countyId: 17,
    address: rank + ' Oak Ave',
    city: 'Miami',
    zip: '33101',
    dorCode: '0101',
    bedrooms: 3,
    bathrooms: 2,
    livingAreaSqft: 1500,
    yearBuilt: '1998',
    saleId: id,
    saleDate: '2026-03-01',
    salePrice: price,
    qualifiedFlag: 'Q',
    qualificationDescription: null,
    instrumentNumber: null,
    matchLevel: 'STRICT',
    distanceMeters: 800,
  },
});
const response = (comparables: ComparableDTO[]): ComparableResponse => ({
  propertyId: 42,
  subject: {
    propertyId: 42,
    countyId: 17,
    dorCode: '0101',
    bedrooms: 3,
    bathrooms: 2,
    livingAreaSqft: 1450,
    yearBuilt: '2000',
  },
  asOfDate: '2026-11-01',
  saleDateFrom: '2024-11-01',
  search: { radiusMeters: 2000, months: 24, limit: 10 },
  selectionVersion: '1',
  rankingVersion: '1',
  candidatePoolLimit: 500,
  consideredCandidates: 30,
  candidatePoolLimitReached: false,
  minimumCandidates: 3,
  returnedCount: comparables.length,
  status: 'OK',
  warnings: [],
  comparables,
  scoringWeights: {},
});

describe('Comparables map helpers', () => {
  it('formats compact price labels for map pills', () => {
    expect(compactPrice(950)).toBe('$950');
    expect(compactPrice(412_400)).toBe('$412K');
    expect(compactPrice(999_600)).toBe('$1M');
    expect(compactPrice(1_250_000)).toBe('$1.3M');
    expect(compactPrice(2_000_000)).toBe('$2M');
    expect(compactPrice(14_600_000)).toBe('$15M');
    expect(compactPrice(null)).toBe('—');
  });
  it('places a marker at the centre of the largest polygon and formats distance and $/sqft', () => {
    const [lat, lon] = geometryCentroid(square(-80.2, 25.7, 0.002))!;
    expect(lat).toBeCloseTo(25.701, 6);
    expect(lon).toBeCloseTo(-80.199, 6);
    expect(geometryCentroid({ type: 'MultiPolygon', coordinates: [] })).toBeNull();
    expect(metersToMiles(1609.344)).toBe('1.0 mi');
    expect(metersToMiles(50)).toBe('< 0.1 mi');
    expect(metersToMiles(null)).toBe('Distance unknown');
    expect(pricePerSqft(300_000, 1500)).toBe(200);
    expect(pricePerSqft(300_000, null)).toBeNull();
  });
});

describe('Comparables map', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ComparablesMap],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ...provideTestStore(),
        {
          provide: KeycloakService,
          useValue: { isLoggedIn: () => false, hasRealmRole: () => false },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  const create = () => {
    const fixture = TestBed.createComponent(ComparablesMap);
    fixture.componentRef.setInput('propertyId', 42);
    fixture.componentRef.setInput('subject', {
      folio: '000042',
      countyId: 17,
      address: '42 Oak Ave',
    });
    fixture.detectChanges();
    return fixture;
  };

  it('looks up the home and every comparable by folio and county, and notes the ones it cannot place', () => {
    const fixture = create();
    const request = http.expectOne((r) => r.url.endsWith('/properties/id/42/comparables'));
    expect(request.request.params.get('radiusMeters')).toBe('2000');
    request.flush(response([comp(1, 7, '000007', 412_000), comp(2, 8, '000008', 1_250_000)]));
    fixture.detectChanges();

    const lookups = http.match((r) => r.url.endsWith('/parcels/byfolio'));
    expect(
      lookups
        .map((r) => r.request.params.get('folio') + '/' + r.request.params.get('countyId'))
        .sort(),
    ).toEqual(['000007/17', '000008/17', '000042/17']);
    const byFolio = (f: string) => lookups.find((r) => r.request.params.get('folio') === f)!;
    byFolio('000042').flush([parcel('000042', 17, -80.2, 25.7)]);
    byFolio('000007').flush([parcel('000007', 17, -80.21, 25.71)]);
    byFolio('000008').flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    const c = fixture.componentInstance;
    expect(c.subjectPlaced()).toBe(true);
    expect(Object.keys(c.placed())).toEqual(['7']);
    expect(c.unplaced()).toBe(1);
    expect(c.placing()).toBe(false);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('1 comparable could not be placed on the map');
    // The list still carries every comparable, including the one missing from the map.
    expect(fixture.nativeElement.querySelectorAll('.complist li')).toHaveLength(2);
    expect(text).toContain('not on map');
  });

  it('shows an empty state when no comparable sales are found', () => {
    const fixture = create();
    http.expectOne((r) => r.url.endsWith('/comparables')).flush(response([]));
    // The home itself is still looked up, but there is nothing to compare it with.
    http.match((r) => r.url.endsWith('/parcels/byfolio')).forEach((r) => r.flush([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No comparable sales were found');
    expect(fixture.nativeElement.querySelector('.complist')).toBeNull();
  });

  it('reports a failed comparables request with a retry', () => {
    const fixture = create();
    http
      .expectOne((r) => r.url.endsWith('/comparables'))
      .flush('Down', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toContain('Comparable sales could not be loaded');
    fixture.componentInstance.reload();
    http.expectOne((r) => r.url.endsWith('/comparables')).flush(response([]));
    http.match((r) => r.url.endsWith('/parcels/byfolio')).forEach((r) => r.flush([]));
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBeNull();
  });
});
