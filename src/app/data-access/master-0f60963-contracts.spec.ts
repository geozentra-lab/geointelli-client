import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../store';
import { AdminService } from './admin.service';
import { DashboardService } from './dashboard.service';
import { InvestmentAnalysisService } from './investment-analysis.service';
import { LenderService } from './lender.service';
import { OpportunityService } from './opportunity.service';
import { RealtorLicenseService } from './realtor-license.service';
import { ScenarioService } from './scenario.service';
import { ValuationService } from './valuation.service';
import { OpportunitiesActions as O } from '../store/opportunities/opportunities.actions';
import { selectOpportunities } from '../store/opportunities/opportunities.selectors';
import { RealtorLicenseActions as L } from '../store/realtor-license/realtor-license.actions';
import { selectRealtorLicense } from '../store/realtor-license/realtor-license.selectors';
import { UserActions } from '../store/user/user.actions';
import { selectUserState } from '../store/user/user.selectors';
import { AdminActions as A } from '../store/admin/admin.actions';
import { selectAdmin } from '../store/admin/admin.selectors';
import { CatalogActions as C } from '../store/catalog/catalog.actions';
import { selectCatalog } from '../store/catalog/catalog.selectors';
import { InvestmentActions as I } from '../store/investment/investment.actions';
import { selectInvestment } from '../store/investment/investment.selectors';
import { PropertyInsightsActions as P } from '../store/property-insights/property-insights.actions';
import { propertyInsightsReducer } from '../store/property-insights/property-insights.reducer';
import { UserDTO } from '../core/models/api';

/** Endpoints added to property-service master up to 0f60963, and the slices that read them. */
describe('Backend master 0f60963 contracts', () => {
  let http: HttpTestingController;
  let store: Store;
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
    store = TestBed.inject(Store);
  });
  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('calls each new endpoint with its documented path, parameters and headers', () => {
    const dashboards = TestBed.inject(DashboardService);
    dashboards.activity(6).subscribe();
    http
      .expectOne(
        (r) => r.url.endsWith('/dashboards/user/activity') && r.params.get('limit') === '6',
      )
      .flush({});
    dashboards.investorValueEquityDebt(5).subscribe();
    http
      .expectOne(
        (r) =>
          r.url.endsWith('/dashboards/investor/value-equity-debt') &&
          r.params.get('portfolioId') === '5',
      )
      .flush({});
    dashboards.investorOccupancyExposure(null).subscribe();
    http
      .expectOne(
        (r) =>
          r.url.endsWith('/dashboards/investor/occupancy-exposure') && r.params.keys().length === 0,
      )
      .flush({});

    TestBed.inject(LenderService).approvedFunded(42, '2026-10-01', '2026-10-31').subscribe();
    const funded = http.expectOne((r) => r.url.endsWith('/dashboards/lender/approved-funded'));
    expect(funded.request.params.toString()).toBe(
      'organizationId=42&fromDate=2026-10-01&toDate=2026-10-31',
    );
    funded.flush({});

    TestBed.inject(ValuationService).history(9, 1, 10).subscribe();
    const history = http.expectOne((r) => r.url.endsWith('/properties/id/9/valuations'));
    expect(history.request.params.get('page')).toBe('1');
    history.flush({});
    TestBed.inject(ValuationService).opportunityScore(9).subscribe();
    http.expectOne((r) => r.url.endsWith('/properties/id/9/opportunity-score')).flush({});

    TestBed.inject(OpportunityService)
      .browse({ page: 0, size: 12, sort: 'VALUE_ASC', countyId: 17, minScore: null })
      .subscribe();
    const browse = http.expectOne((r) => r.url.endsWith('/opportunities'));
    // Filters that are not set are left out, so the server does not apply them.
    expect(browse.request.params.toString()).toBe('page=0&size=12&sort=VALUE_ASC&countyId=17');
    browse.flush({});
    TestBed.inject(OpportunityService).refresh('FULL').subscribe();
    const refresh = http.expectOne((r) => r.url.endsWith('/admin/opportunity-scores/refresh'));
    expect(refresh.request.method).toBe('POST');
    expect(refresh.request.params.get('mode')).toBe('FULL');
    refresh.flush({});

    TestBed.inject(InvestmentAnalysisService)
      .investment({ operating: { monthlyRent: 2500 } })
      .subscribe();
    const investment = http.expectOne((r) => r.url.endsWith('/calculations/investment'));
    expect(investment.request.body).toEqual({ operating: { monthlyRent: 2500 } });
    investment.flush({});

    const scenarios = TestBed.inject(ScenarioService);
    scenarios.update(3, { name: 'Duplex' }).subscribe();
    const patch = http.expectOne((r) => r.url.endsWith('/scenarios/3'));
    expect(patch.request.method).toBe('PATCH');
    patch.flush({});
    scenarios.remove(3).subscribe();
    expect(http.expectOne((r) => r.url.endsWith('/scenarios/3')).request.method).toBe('DELETE');

    TestBed.inject(RealtorLicenseService).history().subscribe();
    http.expectOne((r) => r.url.endsWith('/users/me/realtor-license/history')).flush([]);

    const admin = TestBed.inject(AdminService);
    admin.dataQuality('SALE_DUPLICATE', 2).subscribe();
    const quality = http.expectOne((r) => r.url.endsWith('/admin/data-quality/issues'));
    expect(quality.request.params.toString()).toBe('rule=SALE_DUPLICATE&page=2&size=20');
    quality.flush({});
    admin.retryValuationRefresh('abc', 'key-1').subscribe();
    const retry = http.expectOne((r) =>
      r.url.endsWith('/admin/valuation-refresh-requests/abc/retry'),
    );
    expect(retry.request.headers.get('Idempotency-Key')).toBe('key-1');
    retry.flush({});
  });

  it('keeps the browse filters with their results and rereads them after a rescoring run', () => {
    const query = { page: 0, size: 12, sort: 'SCORE_DESC' as const, minScore: 40 };
    store.dispatch(O.browse({ query }));
    http
      .expectOne((r) => r.url.endsWith('/opportunities'))
      .flush({
        scoreVersion: 'opportunity-v1',
        status: 'OK',
        filters: {},
        sort: 'SCORE_DESC',
        results: { content: [], page: 0, size: 12, totalElements: 0, totalPages: 0 },
        notes: [],
      });
    store.dispatch(O.refreshScores({ mode: 'INCREMENTAL' }));
    http
      .expectOne((r) => r.url.endsWith('/opportunity-scores/refresh'))
      .flush({
        mode: 'INCREMENTAL',
        scoreVersion: 'opportunity-v1',
        processed: 3,
        scored: 2,
        unavailable: 1,
        removed: 0,
        startedAt: '',
        finishedAt: '',
        durationMillis: 40,
      });
    // The list on screen is read again with the same filters.
    const again = http.expectOne((r) => r.url.endsWith('/opportunities'));
    expect(again.request.params.get('minScore')).toBe('40');
    again.flush({});
    let refreshed = 0;
    store
      .select(selectOpportunities)
      .subscribe((s) => (refreshed = s.refresh.value?.processed ?? 0));
    expect(refreshed).toBe(3);
  });

  it('a license submission becomes the profile status, and a second one is refused politely', () => {
    // profileSaved sets the profile without the first-load requests (preferences, favorites…).
    store.dispatch(UserActions.profileSaved({ profile: { id: 7, persona: 'REALTOR' } as UserDTO }));
    store.dispatch(
      L.submit({
        request: { licenseHolderName: 'Ana Ruiz', licensingState: 'FL', licenseNumber: 'SL123' },
      }),
    );
    http
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/users/me/realtor-license'))
      .flush({
        id: 1,
        licenseHolderName: 'Ana Ruiz',
        licensingState: 'FL',
        licenseNumber: 'SL123',
        status: 'PENDING_REVIEW',
        submittedAt: '2026-11-16T09:00:00Z',
      });
    let status: string | null | undefined;
    store.select(selectUserState).subscribe((u) => (status = u.profile?.realtorLicenseStatus));
    expect(status).toBe('PENDING_REVIEW');
    store.dispatch(
      L.submit({
        request: { licenseHolderName: 'Ana Ruiz', licensingState: 'FL', licenseNumber: 'SL123' },
      }),
    );
    http
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/users/me/realtor-license'))
      .flush('conflict', { status: 409, statusText: 'Conflict' });
    let error: string | null = null;
    store.select(selectRealtorLicense).subscribe((s) => (error = s.submitError));
    expect(error).toContain('already pending or verified');
  });

  it('a retried revaluation is listed first and the failed one stays as it was', () => {
    store.dispatch(A.loadRefreshRequests({ status: null, page: 0 }));
    const failed = { requestId: 'old', status: 'FAILED', triggerType: 'SALE_CHANGE' };
    http
      .expectOne((r) => r.url.endsWith('/admin/valuation-refresh-requests'))
      .flush({ content: [failed], page: 0, size: 20, totalElements: 1, totalPages: 1 });
    store.dispatch(A.retryRefresh({ id: 'old', idempotencyKey: 'k' }));
    http
      .expectOne((r) => r.url.endsWith('/old/retry'))
      .flush({ requestId: 'new', status: 'PENDING', triggerType: 'SALE_CHANGE' });
    let ids: string[] = [];
    store
      .select(selectAdmin)
      .subscribe((s) => (ids = s.refreshes.value!.content.map((r) => r.requestId)));
    expect(ids).toEqual(['new', 'old']);
  });

  it('each typeahead keeps its own results; a newer query cancels only its own request', async () => {
    vi.useFakeTimers();
    store.dispatch(C.lookup({ key: 'a', source: 'catalog', query: 'brick' }));
    store.dispatch(C.lookup({ key: 'b', source: 'catalog', query: 'coral' }));
    await vi.advanceTimersByTimeAsync(300);
    const [first, second] = http.match((r) => r.url.endsWith('/properties/search'));
    store.dispatch(C.lookup({ key: 'a', source: 'catalog', query: 'brickell' }));
    expect(first.cancelled).toBe(true);
    expect(second.cancelled).toBe(false);
    second.flush({
      content: [{ id: 5, folio: '01' }],
      page: 0,
      size: 8,
      totalElements: 1,
      totalPages: 1,
    });
    await vi.advanceTimersByTimeAsync(300);
    http
      .expectOne((r) => r.url.endsWith('/properties/search'))
      .flush({
        content: [],
        page: 0,
        size: 8,
        totalElements: 0,
        totalPages: 0,
      });
    let lookups: Record<string, { query: string; items: unknown[] }> = {};
    store.select(selectCatalog).subscribe((s) => (lookups = s.lookups));
    expect(lookups['a']).toEqual(expect.objectContaining({ query: 'brickell', items: [] }));
    expect(lookups['b'].items.length).toBe(1);
    store.dispatch(C.lookupClosed({ key: 'b' }));
    expect(lookups['b']).toBeUndefined();
    // Cards found by a lookup are cached, so the catalog fetches their photos.
    http.match((r) => r.url.includes('/images/property/')).forEach((r) => r.flush([]));
  });

  it('a saved scenario keeps the inputs only and becomes the one in the form', () => {
    store.dispatch(I.loadScenarios());
    http
      .expectOne((r) => r.url.endsWith('/scenarios'))
      .flush({
        content: [],
        page: 0,
        size: 50,
        totalElements: 0,
        totalPages: 0,
      });
    const assumptions = { operating: { monthlyRent: 2500 } };
    store.dispatch(
      I.createScenario({ request: { name: 'Duplex', scenarioType: 'INVESTMENT', assumptions } }),
    );
    const create = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/scenarios'));
    expect(create.request.body).toEqual({
      name: 'Duplex',
      scenarioType: 'INVESTMENT',
      assumptions,
    });
    create.flush({ id: 11, name: 'Duplex', scenarioType: 'INVESTMENT', assumptions });
    let state = { activeId: null as number | null, total: 0 };
    store
      .select(selectInvestment)
      .subscribe(
        (s) => (state = { activeId: s.activeId, total: s.scenarios.value!.totalElements }),
      );
    expect(state).toEqual({ activeId: 11, total: 1 });
  });

  it('drops a late answer for a property the page has left, and never shows it under the new one', () => {
    let s = propertyInsightsReducer(undefined, P.loadHistory({ propertyId: 1, page: 0 }));
    s = propertyInsightsReducer(s, P.loadOpportunity({ propertyId: 2 }));
    s = propertyInsightsReducer(
      s,
      P.historyLoaded({
        propertyId: 1,
        page: { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 },
      }),
    );
    expect(s.propertyId).toBe(2);
    expect(s.history.value).toBeNull();
    expect(s.opportunity.loading).toBe(true);
  });
});
