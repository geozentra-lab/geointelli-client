import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '.';
import { favoritesActions as F } from './favorites/favorites.actions';
import { selectFavoriteState, selectFavorites } from './favorites/favorites.selectors';
import { portfolioActions as P } from './portfolio/portfolio.actions';
import { selectPortfolioState } from './portfolio/portfolio.selectors';
import { UserActions as U } from './user/user.actions';
import { CatalogActions as C } from './catalog/catalog.actions';
import { selectCatalog } from './catalog/catalog.selectors';
describe('Server-backed NgRx state', () => {
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
  it('adds a favorite only after server acknowledgement and preserves it on failed removal', () => {
    store.dispatch(F.add({ propertyId: 42 }));
    expect(store.selectSignal(selectFavorites)()).toHaveLength(0);
    const request = http.expectOne((r) => r.url.endsWith('/properties/42/favorite'));
    request.flush({ propertyId: 42, favorite: true, createdAt: '2026-10-01' });
    expect(store.selectSignal(selectFavorites)()).toHaveLength(1);
    store.dispatch(F.remove({ propertyId: 42 }));
    http
      .expectOne((r) => r.url.endsWith('/properties/42/favorite'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(store.selectSignal(selectFavorites)()).toHaveLength(1);
    expect(store.selectSignal(selectFavoriteState)().pending).toEqual([]);
  });
  it('selects a portfolio and actually loads its holdings, summary and financial records', () => {
    store.dispatch(P.select({ id: 2 }));
    const h = http.expectOne((r) => r.url.endsWith('/portfolios/2/holdings'));
    const summary = http.expectOne((r) => r.url.endsWith('/portfolios/2/summary'));
    expect(h.cancelled).toBe(false);
    expect(summary.cancelled).toBe(false);
    h.flush({
      content: [{ id: 8, portfolioId: 2, propertyId: 42 }],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    const records = http.expectOne((r) =>
      r.url.endsWith('/portfolios/2/holdings/8/financial-records'),
    );
    expect(records.cancelled).toBe(false);
    records.flush({ content: [], page: 0, totalElements: 0, totalPages: 0 });
    summary.flush({
      portfolioId: 2,
      status: 'PARTIAL',
      valuationAndDebt: {
        value: { total: null, knownTotal: 100000, coveredHoldings: 1, totalHoldings: 2 },
      },
    });
    expect(
      store.selectSignal(selectPortfolioState)().summary?.valuationAndDebt?.value.total,
    ).toBeNull();
  });
  it('rejects a holding response from another portfolio context', () => {
    store.dispatch(P.select({ id: 2 }));
    const old = http.expectOne((r) => r.url.endsWith('/portfolios/2/holdings'));
    const oldSummary = http.expectOne((r) => r.url.endsWith('/portfolios/2/summary'));
    store.dispatch(P.select({ id: 3 }));
    expect(old.cancelled).toBe(true);
    expect(oldSummary.cancelled).toBe(true);
    http
      .expectOne((r) => r.url.endsWith('/portfolios/3/holdings'))
      .flush({ content: [], page: 0, totalElements: 0, totalPages: 0 });
    http.expectOne((r) => r.url.endsWith('/portfolios/3/summary')).flush({ portfolioId: 3 });
    expect(store.selectSignal(selectPortfolioState)().selectedId).toBe(3);
  });
  it('clears private data and cancels in-flight and queued writes on sign-out, then accepts new work', () => {
    store.dispatch(F.add({ propertyId: 42 }));
    const old = http.expectOne((r) => r.url.endsWith('/properties/42/favorite'));
    store.dispatch(F.add({ propertyId: 43 }));
    store.dispatch(U.signedOut());
    expect(old.cancelled).toBe(true);
    http.expectNone((r) => r.url.endsWith('/properties/43/favorite'));
    expect(store.selectSignal(selectFavoriteState)().pending).toEqual([]);
    store.dispatch(F.add({ propertyId: 44 }));
    http
      .expectOne((r) => r.url.endsWith('/properties/44/favorite'))
      .flush({ propertyId: 44, favorite: true });
    expect(store.selectSignal(selectFavorites)()[0].propertyId).toBe(44);
  });
  it('cancels a pending search debounce on sign-out', async () => {
    store.dispatch(C.search({ query: { address: 'private address' } }));
    store.dispatch(U.signedOut());
    await new Promise((r) => setTimeout(r, 300));
    http.expectNone((r) => r.url.endsWith('/properties/search'));
    expect(store.selectSignal(selectCatalog)().query.address).toBeUndefined();
  });
  it('preserves reporting dates after a successful mutation', () => {
    store.dispatch(P.loadSummary({ id: 2, fromDate: '2026-01-01', toDate: '2026-09-30' }));
    http.expectOne((r) => r.url.endsWith('/portfolios/2/summary')).flush({ portfolioId: 2 });
    expect(store.selectSignal(selectPortfolioState)().summaryQuery).toEqual({
      fromDate: '2026-01-01',
      toDate: '2026-09-30',
    });
  });
});
