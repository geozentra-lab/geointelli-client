import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '.';
import { KeycloakService } from '../core/auth/keycloak.service';
import { PropertySearchItem } from '../core/models/api';
import { ImportJobDTO } from '../core/models/import-job';
import { ImportJobsActions } from './import-jobs/import-jobs.actions';
import { importJobsReducer } from './import-jobs/import-jobs.reducer';
import { selectImportJobs } from './import-jobs/import-jobs.selectors';
import { CatalogActions } from './catalog/catalog.actions';
import { UserActions } from './user/user.actions';
import { favoritesActions } from './favorites/favorites.actions';
import { CrmActions } from './crm/crm.actions';
import { portfolioActions } from './portfolio/portfolio.actions';

/**
 * Two store fixes (approved Nov 20, 2026, after item 10): a failed background refresh of Import jobs
 * no longer leaves a visible load waiting for ever, and a property lookup waiting its turn is not
 * queued twice.
 */
describe('Store fixes', () => {
  let store: Store;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => true, hasRealmRole: () => true } },
      ],
    });
    store = TestBed.inject(Store);
    http = TestBed.inject(HttpTestingController);
  });
  const jobs = () => {
    let state!: ReturnType<typeof importJobsReducer>;
    store.select(selectImportJobs).subscribe((s) => (state = s)).unsubscribe();
    return state;
  };
  const fail = { status: 500, statusText: 'Server Error' };
  const page = (n: number) => ({ jobs: { content: [], page: n, size: 20, totalElements: 0, totalPages: 1 }, untrackedJobTypes: [], note: null });

  describe('Import jobs', () => {
    const lists = () => http.match((r) => r.url.endsWith('/admin/import-jobs'));
    const details = (id: string) => http.match((r) => r.url.endsWith('/admin/import-jobs/' + id));

    it('ends a visible load with the error when the background refresh that replaced it fails', () => {
      store.dispatch(ImportJobsActions.load({ page: 1 }));
      const [visible] = lists();
      expect(jobs().loading).toBe(true);
      // The poll fires while the visible load is still out: switchMap cancels it.
      store.dispatch(ImportJobsActions.load({ page: 1, silent: true }));
      const [silent] = lists();
      expect(visible.cancelled).toBe(true);
      silent.flush({ message: 'Down for maintenance' }, fail);
      // Before the fix: loading stayed true, Refresh refused and the table said "Loading…".
      expect(jobs().loading).toBe(false);
      expect(jobs().error).toBeTruthy();
    });

    it('keeps the table steady and quiet when a background refresh fails on its own', () => {
      store.dispatch(ImportJobsActions.load({ page: 0 }));
      lists()[0].flush(page(0));
      const before = jobs();
      expect(before.loading).toBe(false);
      store.dispatch(ImportJobsActions.load({ page: 0, silent: true }));
      lists()[0].flush({ message: 'Down for maintenance' }, fail);
      expect(jobs()).toBe(before);
      expect(jobs().error).toBeNull();
      // The reducer's rule on its own: nothing waiting, nothing changes.
      expect(importJobsReducer(before, ImportJobsActions.refreshFailed({ error: 'x' }))).toBe(before);
    });

    it('ends an open job’s wait the same way when its background refresh fails', () => {
      store.dispatch(ImportJobsActions.openJob({ id: 'j-1' }));
      const [visible] = details('j-1');
      expect(jobs().jobLoading).toBe(true);
      store.dispatch(ImportJobsActions.openJob({ id: 'j-1', silent: true }));
      const [silent] = details('j-1');
      expect(visible.cancelled).toBe(true);
      silent.flush({ message: 'Down for maintenance' }, fail);
      expect(jobs().jobLoading).toBe(false);
      expect(jobs().jobError).toBeTruthy();

      // Loaded, then a quiet refresh fails: the job stays on screen without an error.
      store.dispatch(ImportJobsActions.openJob({ id: 'j-1' }));
      details('j-1')[0].flush({ id: 'j-1' } as ImportJobDTO);
      const loaded = jobs();
      store.dispatch(ImportJobsActions.openJob({ id: 'j-1', silent: true }));
      details('j-1')[0].flush({ message: 'Down for maintenance' }, fail);
      expect(jobs()).toBe(loaded);
      expect(jobs().jobError).toBeNull();
    });
  });

  describe('Property lookups', () => {
    const byId = () => http.match((r) => /\/properties\/id\/\d+$/.test(r.url));
    const idOf = (url: string) => Number(url.split('/').pop());
    const property = (id: number) => ({ id, folio: '0141370120450', address: id + ' SW 27th Ter' });

    it('asks once for a property, even when it is asked for again while it waits its turn', () => {
      for (const id of [1, 2, 3, 4, 5]) store.dispatch(CatalogActions.resolveProperty({ id }));
      const first = byId();
      // Four at a time; 5 waits.
      expect(first.map((r) => idOf(r.request.url))).toEqual([1, 2, 3, 4]);
      // Asked again while waiting (two places on one page): not queued a second time.
      store.dispatch(CatalogActions.resolveProperty({ id: 5 }));
      store.dispatch(CatalogActions.resolveProperty({ id: 5 }));
      expect(byId().length).toBe(0);
      first[0].flush(property(1));
      const next = byId();
      expect(next.map((r) => idOf(r.request.url))).toEqual([5]);
      // Its turn comes once: before the fix, 5 was fetched three times.
      for (const r of first.slice(1)) r.flush(property(idOf(r.request.url)));
      next[0].flush(property(5));
      expect(byId().length).toBe(0);
    });

    it('skips a waiting lookup when the property arrives some other way first', () => {
      for (const id of [11, 12, 13, 14, 15]) store.dispatch(CatalogActions.resolveProperty({ id }));
      const first = byId();
      expect(first.length).toBe(4);
      // A page of search results brings 15 while it waits.
      store.dispatch(
        CatalogActions.cacheItems({ items: [{ ...property(15), countyId: 1 } as PropertySearchItem] }),
      );
      first[0].flush(property(11));
      expect(byId().length).toBe(0);
      // Asked for again later, it is already known: nothing to ask.
      store.dispatch(CatalogActions.resolveProperty({ id: 15 }));
      expect(byId().length).toBe(0);
    });

    it('starts a new session with nothing pending, even ids that were waiting their turn', () => {
      for (const id of [31, 32, 33, 34, 35]) store.dispatch(CatalogActions.resolveProperty({ id }));
      const first = byId();
      expect(first.length).toBe(4);
      // The session ends with 35 still waiting (sign-out, or a failed token refresh).
      store.dispatch(UserActions.signedOut());
      expect(first.every((r) => r.cancelled)).toBe(true);
      expect(byId().length).toBe(0);
      // The next session asks for 35 and for one that was in flight: both are fetched.
      store.dispatch(CatalogActions.resolveProperty({ id: 35 }));
      store.dispatch(CatalogActions.resolveProperty({ id: 31 }));
      expect(byId().map((r) => idOf(r.request.url))).toEqual([35, 31]);
    });

    it('asks again after a failure, when a caller retries', () => {
      store.dispatch(CatalogActions.resolveProperty({ id: 21 }));
      byId()[0].flush({ message: 'Down for maintenance' }, fail);
      store.dispatch(CatalogActions.resolveProperty({ id: 21 }));
      expect(byId().map((r) => idOf(r.request.url))).toEqual([21]);
    });
  });

  // Found by the API audit of Nov 26, 2026.
  describe('Out of step with the server', () => {
    const favorites = () => http.match((r) => r.method === 'GET' && r.url.endsWith('/properties/favorites'));
    it('reads the favorites again when a toggle was out of step (500, 404, 409), not after a lost connection', () => {
      store.dispatch(favoritesActions.add({ propertyId: 42 }));
      http
        .expectOne((r) => r.method === 'POST' && r.url.endsWith('/properties/42/favorite'))
        .flush({ message: 'Property is already a favorite' }, { status: 500, statusText: 'Server Error' });
      expect(favorites()).toHaveLength(1);
      store.dispatch(favoritesActions.remove({ propertyId: 42 }));
      http
        .expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/properties/42/favorite'))
        .flush({}, { status: 503, statusText: 'Unavailable' });
      // A 503 keeps Retry: nothing is read again.
      expect(favorites()).toHaveLength(0);
    });

    it('steps back from an empty CRM page left by a write, to the last page with records', () => {
      const clients = () => http.match((r) => r.method === 'GET' && r.url.endsWith('/clients'));
      const row = { id: 1, name: 'Haley Brooks' };
      // The last client of page 3 was deleted: page index 2 comes back empty, 2 pages in all.
      store.dispatch(CrmActions.loadClients({ page: 2 }));
      clients()[0].flush({ content: [], page: 2, size: 20, totalElements: 40, totalPages: 2 });
      const back = clients();
      expect(back.map((r) => r.request.params.get('page'))).toEqual(['1']);
      back[0].flush({ content: [row], page: 1, size: 20, totalElements: 40, totalPages: 2 });
      expect(clients()).toHaveLength(0);
      // The first page empty is the answer itself ("Clients you add appear here").
      store.dispatch(CrmActions.loadClients({ page: 0 }));
      clients()[0].flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
      expect(clients()).toHaveLength(0);
    });

    it('does not read again a portfolio or holding just deleted (the backend answers 404)', () => {
      store.dispatch(portfolioActions.select({ id: 2 }));
      http.match((r) => r.url.includes('/portfolios/2/')).forEach((r) => r.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
      store.dispatch(portfolioActions.mutate({ mutation: { kind: 'remove-portfolio', id: 2 } }));
      http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/portfolios/2')).flush(null);
      expect(http.match((r) => r.url.includes('/portfolios/2/'))).toHaveLength(0);
      http.match((r) => r.method === 'GET' && r.url.endsWith('/portfolios')).forEach((r) => r.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    });
  });
});
