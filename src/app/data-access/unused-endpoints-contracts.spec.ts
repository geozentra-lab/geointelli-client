import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../store';
import { ComparableService } from './comparable.service';
import { ImportJobService } from './import-job.service';
import { MapLayerService } from './map-layer.service';
import { PropertyService } from './property.service';
import { SavedSearchService } from './saved-search.service';
import { ImportJobsActions as J } from '../store/import-jobs/import-jobs.actions';
import { selectImportJobs } from '../store/import-jobs/import-jobs.selectors';
import { retryError } from '../store/import-jobs/import-jobs.effects';
import { PropertyFeatures } from '../features/property-detail/property-features';

describe('Backend master endpoints the client now uses', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ...provideTestStore(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('calls each endpoint with the documented path and parameters', () => {
    TestBed.inject(ComparableService)
      .candidates(301400, { radiusMeters: 800, months: 12 })
      .subscribe();
    const candidates = http.expectOne((r) =>
      r.url.endsWith('/properties/id/301400/comparables/candidates'),
    );
    expect(candidates.request.params.get('radiusMeters')).toBe('800');
    candidates.flush({});

    TestBed.inject(PropertyService)
      .extraFeatures(5, { history: true, page: 1, size: 25 })
      .subscribe();
    const features = http.expectOne((r) => r.url.endsWith('/properties/id/5/extra-features'));
    expect(features.request.params.get('history')).toBe('true');
    features.flush({});

    TestBed.inject(SavedSearchService).results(9, 0, 8).subscribe();
    const results = http.expectOne((r) => r.url.endsWith('/saved-searches/9/results'));
    expect(results.request.params.get('size')).toBe('8');
    results.flush({});

    TestBed.inject(MapLayerService).layers().subscribe();
    http.expectOne((r) => r.url.endsWith('/map/layers')).flush([]);

    const jobs = TestBed.inject(ImportJobService);
    jobs.retry('4f1c7d2e-9b2a').subscribe();
    const retry = http.expectOne((r) => r.url.endsWith('/admin/import-jobs/4f1c7d2e-9b2a/retry'));
    expect(retry.request.method).toBe('POST');
    retry.flush({});
    const file = new File(['folio\n1'], 'sales.csv');
    jobs.importCsv('sales', file, 'Miami-Dade', 'FL').subscribe();
    const upload = http.expectOne((r) => r.url.endsWith('/ingestion/import/sales'));
    const body = upload.request.body as FormData;
    expect([body.get('county'), body.get('sourceState'), (body.get('file') as File).name]).toEqual([
      'Miami-Dade',
      'FL',
      'sales.csv',
    ]);
    upload.flush({});
  });

  it('opens the retried job and explains a refused retry', () => {
    const store = TestBed.inject(Store);
    store.dispatch(J.retry({ id: 'old' }));
    http
      .expectOne((r) => r.url.endsWith('/admin/import-jobs/old/retry'))
      .flush(
        { id: 'new', retryOfJobId: 'old', status: 'QUEUED' },
        { status: 202, statusText: 'Accepted' },
      );
    expect(store.selectSignal(selectImportJobs)()).toMatchObject({
      selectedId: 'new',
      retrying: null,
    });
    // The list refreshes so the new attempt appears.
    http
      .expectOne((r) => r.url.endsWith('/admin/import-jobs'))
      .flush({
        jobs: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
        untrackedJobTypes: [],
        note: null,
      });
    const refused = new HttpErrorResponse({
      status: 409,
      error: { message: 'INPUT_UNAVAILABLE: the staged file was removed' },
    });
    expect(retryError(refused)).toBe('Retry refused: its input files are no longer available.');
  });

  it('lists a building’s units and shows missing feature values as unavailable', () => {
    const fixture = TestBed.createComponent(PropertyFeatures);
    fixture.componentRef.setInput('propertyId', 77);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/properties/id/77/extra-features'))
      .flush({
        propertyId: 77,
        rollYear: 2026,
        history: false,
        page: 0,
        size: 25,
        totalElements: 1,
        totalPages: 1,
        features: [
          {
            description: 'Pool 8 ft res avg',
            units: 450,
            actualYearBuilt: 1999,
            percentCondition: null,
            depreciatedValue: null,
            rollYear: 2026,
            useCode: null,
            adjustedUnitPrice: null,
            message: null,
          },
        ],
      });
    http
      .expectOne((r) => r.url.endsWith('/properties/id/77/children'))
      .flush({
        content: [{ id: 78, folio: '0131', address: { unit: '4B' }, bedroomCount: 2 }],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('2026 roll year');
    expect(text).toContain('Pool 8 ft res avg');
    // Missing condition and value are the Unavailable marker, never 0 or a dash.
    expect(text).toContain('Unavailable');
    const features = (fixture.nativeElement as HTMLElement).querySelector('table')!;
    expect(features.querySelectorAll('td.na')).toHaveLength(2);
    expect(text).not.toContain('$0');
    expect(text).toContain('Units in this building');
    expect(text).toContain('Unit 4B');
  });
});
