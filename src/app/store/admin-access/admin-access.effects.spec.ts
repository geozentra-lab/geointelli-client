import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store, provideState, provideStore } from '@ngrx/store';
import { Actions, provideEffects } from '@ngrx/effects';
import { environment } from '../../../environments/environment';
import {
  ROLE_MANAGEMENT_UNAVAILABLE,
  RealtorLicenseReviewDTO,
  RoleGrantEventDTO,
  RoleRequestReviewDTO,
} from '../../core/models/account';
import { UiActions } from '../ui/ui.actions';
import { AdminAccessActions as A } from './admin-access.actions';
import { AdminAccessEffects, NO_USER_FOR_EMAIL } from './admin-access.effects';
import { adminAccessReducer, revokeKey } from './admin-access.reducer';
import { currentRoles, selectAdminAccess } from './admin-access.selectors';

const api = environment.apiUrl + '/admin';
const request = (id: number, over: Partial<RoleRequestReviewDTO> = {}): RoleRequestReviewDTO => ({
  id,
  userId: 100 + id,
  applicantEmail: `applicant${id}@example.com`,
  role: 'investor',
  status: 'PENDING',
  organizationName: null,
  note: null,
  decisionReason: null,
  decidedByUserId: null,
  createdAt: '2026-11-18T15:00:00Z',
  decidedAt: null,
  ...over,
});
const license = (
  id: number,
  over: Partial<RealtorLicenseReviewDTO> = {},
): RealtorLicenseReviewDTO => ({
  id,
  applicantUserId: 200 + id,
  applicantEmail: `realtor${id}@example.com`,
  licenseHolderName: 'Dana Ruiz',
  licensingState: 'FL',
  licenseNumber: 'SL3512345',
  licenseExpirationDate: '2027-05-31',
  brokerageName: 'Coastal Realty',
  workEmail: null,
  status: 'PENDING_REVIEW',
  decisionMethod: null,
  reviewedByUserId: null,
  decidedAt: null,
  registrySource: null,
  rejectionReason: null,
  autoCheckResult: 'MATCH',
  autoCheckedAt: '2026-11-18T15:01:00Z',
  autoCheckSource: 'DBPR',
  autoCheckNote: null,
  submittedAt: '2026-11-18T15:00:00Z',
  ...over,
});
const event = (id: number, over: Partial<RoleGrantEventDTO> = {}): RoleGrantEventDTO => ({
  id,
  userId: 7,
  role: 'investor',
  action: 'GRANT',
  source: 'ROLE_REQUEST',
  sourceId: 1,
  reason: null,
  decidedByUserId: 3,
  createdAt: '2026-11-18T15:00:00Z',
  ...over,
});
const page = <T>(content: T[], over: object = {}) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: 1,
  first: true,
  last: true,
  ...over,
});

describe('Admin access effects', () => {
  let http: HttpTestingController;
  let store: Store;
  let seen: Action[];
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore({}),
        provideState('adminAccess', adminAccessReducer),
        provideEffects(AdminAccessEffects),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(Store);
    seen = [];
    TestBed.inject(Actions).subscribe((a) => seen.push(a));
  });
  afterEach(() => http.verify());
  const state = () => store.selectSignal(selectAdminAccess)();
  const toasts = () =>
    seen.filter((a) => a.type === UiActions.toast.type) as ReturnType<typeof UiActions.toast>[];
  /** The backend's error body for an already-decided item. */
  const conflict = (message: string) => ({
    body: { status: 409, error: 'Conflict', message, timestamp: '2026-11-18T15:00:00Z' },
    opts: { status: 409, statusText: 'Conflict' },
  });
  /** Loads one page of pending requests. */
  function loadPending(rows: RoleRequestReviewDTO[]) {
    store.dispatch(A.loadRoleRequests({ query: { status: 'PENDING', role: null, page: 0 } }));
    http.expectOne((r) => r.url === api + '/role-requests').flush(page(rows));
  }

  it('asks for role requests with the status, role and page, and leaves out what is not set', () => {
    store.dispatch(A.loadRoleRequests({ query: { status: 'PENDING', role: 'lender', page: 2 } }));
    const req = http.expectOne((r) => r.url === api + '/role-requests');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('PENDING');
    expect(req.request.params.get('role')).toBe('lender');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    req.flush(page([request(1, { role: 'lender' })], { page: 2 }));
    expect(state().requests.value?.content.map((r) => r.id)).toEqual([1]);

    // All statuses and both roles: neither is sent.
    store.dispatch(A.loadRoleRequests({ query: { status: null, role: null, page: 0 } }));
    const all = http.expectOne((r) => r.url === api + '/role-requests');
    expect(all.request.params.has('status')).toBe(false);
    expect(all.request.params.has('role')).toBe(false);
    // Another filter: the previous filter's rows are not kept on screen.
    expect(state().requests.value).toBeNull();
    all.flush(page([]));
  });

  it('approves with the reason or an empty body, confirms it, and reloads the Pending page the row left', () => {
    loadPending([request(1), request(2, { role: 'lender' })]);
    store.dispatch(A.approveRoleRequest({ id: 1, reason: 'Checked the portfolio.' }));
    expect(state().requestActing[1]).toBe('approve');
    const approve = http.expectOne(api + '/role-requests/1/approve');
    expect(approve.request.method).toBe('POST');
    expect(approve.request.body).toEqual({ reason: 'Checked the portfolio.' });
    approve.flush(request(1, { status: 'APPROVED', decisionReason: 'Checked the portfolio.' }));
    expect(toasts().at(-1)?.message).toBe('Investor access approved for applicant1@example.com.');
    expect(state().requestActing[1]).toBeUndefined();
    // Approved is no longer Pending: the row leaves and the page is read again to fill it.
    expect(state().requests.value?.content.map((r) => r.id)).toEqual([2]);
    expect(state().requests.value?.totalElements).toBe(1);
    const reload = http.expectOne((r) => r.url === api + '/role-requests');
    expect(reload.request.params.get('status')).toBe('PENDING');
    reload.flush(page([request(2, { role: 'lender' })]));

    store.dispatch(A.approveRoleRequest({ id: 2, reason: null }));
    const bare = http.expectOne(api + '/role-requests/2/approve');
    expect(bare.request.body).toEqual({});
    bare.flush(request(2, { role: 'lender', status: 'APPROVED' }));
    expect(toasts().at(-1)?.message).toBe('Lender access approved for applicant2@example.com.');
    http.expectOne((r) => r.url === api + '/role-requests').flush(page([]));
  });

  it('rejects with the reason the applicant sees, and keeps a decided row in place under All', () => {
    store.dispatch(A.loadRoleRequests({ query: { status: null, role: null, page: 0 } }));
    http.expectOne((r) => r.url === api + '/role-requests').flush(page([request(1)]));
    store.dispatch(A.rejectRoleRequest({ id: 1, reason: 'No investment history given.' }));
    const reject = http.expectOne(api + '/role-requests/1/reject');
    expect(reject.request.body).toEqual({ reason: 'No investment history given.' });
    reject.flush(
      request(1, { status: 'REJECTED', decisionReason: 'No investment history given.' }),
    );
    expect(toasts().at(-1)?.message).toBe('Request rejected.');
    expect(state().requests.value?.content[0]).toMatchObject({ id: 1, status: 'REJECTED' });
    // Still listed: nothing to reload.
    http.expectNone((r) => r.url === api + '/role-requests');
  });

  it('sends one decision for a double click, and never holds up a decision on another request', () => {
    loadPending([request(1), request(2)]);
    store.dispatch(A.approveRoleRequest({ id: 1, reason: null }));
    store.dispatch(A.approveRoleRequest({ id: 1, reason: null }));
    store.dispatch(A.rejectRoleRequest({ id: 1, reason: 'Twice' }));
    store.dispatch(A.rejectRoleRequest({ id: 2, reason: 'Not a lender' }));
    expect(http.match(api + '/role-requests/1/approve')).toHaveLength(1);
    expect(http.match(api + '/role-requests/1/reject')).toHaveLength(0);
    expect(http.match(api + '/role-requests/2/reject')).toHaveLength(1);
    expect(state().requestActing).toEqual({ 1: 'approve', 2: 'reject' });
  });

  it('shows a 409 as the backend says it, in the row and a toast, and reads the list again', () => {
    loadPending([request(1)]);
    store.dispatch(A.approveRoleRequest({ id: 1, reason: null }));
    const c = conflict('This role request was already decided.');
    http.expectOne(api + '/role-requests/1/approve').flush(c.body, c.opts);
    expect(state().requestErrors[1]).toBe('This role request was already decided.');
    expect(toasts().at(-1)).toMatchObject({
      message: 'This role request was already decided.',
      kind: 'error',
    });
    http.expectOne((r) => r.url === api + '/role-requests').flush(page([]));
    expect(state().requests.value?.content).toEqual([]);
  });

  it('says Keycloak role management is unavailable on a 503 and leaves the request pending', () => {
    loadPending([request(1)]);
    store.dispatch(A.approveRoleRequest({ id: 1, reason: null }));
    http
      .expectOne(api + '/role-requests/1/approve')
      .flush(
        { status: 503, error: 'Service Unavailable', message: 'Keycloak admin API timeout' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    expect(state().requestErrors[1]).toBe(ROLE_MANAGEMENT_UNAVAILABLE);
    expect(state().requests.value?.content[0].status).toBe('PENDING');
    expect(toasts()).toHaveLength(0);
    http.expectNone((r) => r.url === api + '/role-requests');
    // A second try is sent again: the failed one is over.
    store.dispatch(A.approveRoleRequest({ id: 1, reason: null }));
    expect(state().requestErrors[1]).toBeUndefined();
    http.expectOne(api + '/role-requests/1/approve').flush(request(1, { status: 'APPROVED' }));
    http.expectOne((r) => r.url === api + '/role-requests').flush(page([]));
  });

  it('says a request is gone on a 404 and reads the list again; a 400 gives its message', () => {
    loadPending([request(1), request(2)]);
    store.dispatch(A.rejectRoleRequest({ id: 1, reason: 'x' }));
    http
      .expectOne(api + '/role-requests/1/reject')
      .flush({ status: 404, message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    expect(state().requestErrors[1]).toBe('This role request could not be found.');
    http.expectOne((r) => r.url === api + '/role-requests').flush(page([request(2)]));
    store.dispatch(A.rejectRoleRequest({ id: 2, reason: 'y' }));
    http
      .expectOne(api + '/role-requests/2/reject')
      .flush(
        { status: 400, message: 'reason: size must be between 1 and 500' },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(state().requestErrors[2]).toBe('reason: size must be between 1 and 500');
    http.expectNone((r) => r.url === api + '/role-requests');
  });

  it('reviews licenses: the list by status, approve with the registry, reject with the reason, 503 kept pending', () => {
    store.dispatch(A.loadLicenses({ query: { status: 'PENDING_REVIEW', page: 0 } }));
    const list = http.expectOne((r) => r.url === api + '/realtor-license-verifications');
    expect(list.request.params.get('status')).toBe('PENDING_REVIEW');
    expect(list.request.params.get('page')).toBe('0');
    expect(list.request.params.get('size')).toBe('20');
    list.flush(page([license(1), license(2), license(3)]));

    store.dispatch(A.approveLicense({ id: 1, registrySource: 'Florida DBPR licensee search' }));
    const approve = http.expectOne(api + '/realtor-license-verifications/1/approve');
    expect(approve.request.body).toEqual({ registrySource: 'Florida DBPR licensee search' });
    approve.flush(
      license(1, { status: 'VERIFIED', decisionMethod: 'MANUAL', reviewedByUserId: 3 }),
    );
    expect(toasts().at(-1)?.message).toBe('Realtor access approved for realtor1@example.com.');
    http
      .expectOne((r) => r.url === api + '/realtor-license-verifications')
      .flush(page([license(2), license(3)]));

    store.dispatch(
      A.rejectLicense({
        id: 2,
        registrySource: 'Florida DBPR licensee search',
        rejectionReason: 'Number belongs to another licensee.',
      }),
    );
    const reject = http.expectOne(api + '/realtor-license-verifications/2/reject');
    expect(reject.request.body).toEqual({
      registrySource: 'Florida DBPR licensee search',
      rejectionReason: 'Number belongs to another licensee.',
    });
    reject.flush(
      license(2, { status: 'REJECTED', rejectionReason: 'Number belongs to another licensee.' }),
    );
    expect(toasts().at(-1)?.message).toBe('License rejected.');
    http
      .expectOne((r) => r.url === api + '/realtor-license-verifications')
      .flush(page([license(3)]));

    store.dispatch(A.approveLicense({ id: 3, registrySource: 'Florida DBPR licensee search' }));
    http
      .expectOne(api + '/realtor-license-verifications/3/approve')
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    expect(state().licenseErrors[3]).toBe(ROLE_MANAGEMENT_UNAVAILABLE);
    expect(state().licenses.value?.content[0].status).toBe('PENDING_REVIEW');
    http.expectNone((r) => r.url === api + '/realtor-license-verifications');

    // A 409: the backend's words and the list again.
    store.dispatch(A.approveLicense({ id: 3, registrySource: 'Florida DBPR licensee search' }));
    const c = conflict('This license was already reviewed.');
    http.expectOne(api + '/realtor-license-verifications/3/approve').flush(c.body, c.opts);
    expect(state().licenseErrors[3]).toBe('This license was already reviewed.');
    http.expectOne((r) => r.url === api + '/realtor-license-verifications').flush(page([]));
  });

  it('finds a user by email; a 404 says no account uses it, a 400 gives its message', () => {
    store.dispatch(A.findUser({ email: 'Leo.Marin@example.test' }));
    let r = http.expectOne((r) => r.url === api + '/users');
    expect(r.request.method).toBe('GET');
    expect(r.request.params.get('email')).toBe('Leo.Marin@example.test');
    r.flush({ id: 52, keycloakUserId: 'k', username: 'leo', email: 'leo.marin@example.test', firstName: 'Leo', lastName: 'Marin' });
    expect(state().userLookup.value?.id).toBe(52);

    store.dispatch(A.findUser({ email: 'nobody@example.test' }));
    expect(state().userLookup).toEqual({ value: null, loading: true, error: null });
    http
      .expectOne((r) => r.url === api + '/users')
      .flush({ message: 'No account uses this email' }, { status: 404, statusText: 'Not Found' });
    expect(state().userLookup.error).toBe(NO_USER_FOR_EMAIL);

    store.dispatch(A.findUser({ email: 'a@' }));
    r = http.expectOne((r) => r.url === api + '/users');
    r.flush({ message: 'email must be an email address' }, { status: 400, statusText: 'Bad Request' });
    expect(state().userLookup.error).toBe('email must be an email address');

    // An answer for an email no longer asked about is dropped.
    store.dispatch(A.userFound({ email: 'old@example.test', user: { id: 1 } as never }));
    expect(state().userLookup.value).toBeNull();
  });

  it('reads a user’s role history, revokes with the reason, and reads the history again', () => {
    store.dispatch(A.loadRoleGrants({ userId: 7 }));
    http.expectOne(api + '/users/7/role-grants').flush([event(1)]);
    expect(state().grants.value).toHaveLength(1);

    store.dispatch(
      A.revokeRole({ userId: 7, role: 'investor', reason: 'Wants a lender account.' }),
    );
    store.dispatch(
      A.revokeRole({ userId: 7, role: 'investor', reason: 'Wants a lender account.' }),
    );
    expect(state().revoking[revokeKey(7, 'investor')]).toBe(true);
    const revoke = http.expectOne(api + '/users/7/roles/investor/revoke');
    expect(revoke.request.method).toBe('POST');
    expect(revoke.request.body).toEqual({ reason: 'Wants a lender account.' });
    revoke.flush(null);
    expect(toasts().at(-1)?.message).toBe('Investor access revoked.');
    expect(state().revoking).toEqual({});
    http
      .expectOne(api + '/users/7/role-grants')
      .flush([event(2, { action: 'REVOKE', source: 'ADMIN_REVOCATION' }), event(1)]);

    store.dispatch(A.revokeRole({ userId: 7, role: 'lender', reason: 'x' }));
    http
      .expectOne(api + '/users/7/roles/lender/revoke')
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    expect(state().revokeErrors[revokeKey(7, 'lender')]).toBe(ROLE_MANAGEMENT_UNAVAILABLE);
    http.expectNone(api + '/users/7/role-grants');
  });

  it('never shows one user’s history as another’s, and doesn’t reload a user no longer shown', () => {
    store.dispatch(A.loadRoleGrants({ userId: 7 }));
    http.expectOne(api + '/users/7/role-grants').flush([event(1)]);
    store.dispatch(A.revokeRole({ userId: 7, role: 'investor', reason: 'x' }));
    store.dispatch(A.loadRoleGrants({ userId: 8 }));
    expect(state().grants.value).toBeNull();
    http.expectOne(api + '/users/7/roles/investor/revoke').flush(null);
    http.expectNone(api + '/users/7/role-grants');
    http.expectOne(api + '/users/8/role-grants').flush([]);
    expect(state().grantsUserId).toBe(8);
  });

  it('works out the current roles: a role whose newest event is a grant', () => {
    expect(
      currentRoles([
        event(4, { role: 'lender', action: 'REVOKE', createdAt: '2026-11-20T10:00:00Z' }),
        event(3, { role: 'investor', createdAt: '2026-11-19T10:00:00Z' }),
        event(2, { role: 'lender', createdAt: '2026-11-18T10:00:00Z' }),
        event(1, {
          role: 'realtor',
          action: 'REVOKE',
          source: 'LICENSE_EXPIRY',
          createdAt: '2026-11-17T10:00:00Z',
        }),
      ]).map((c) => c.role),
    ).toEqual(['investor']);
    expect(currentRoles([])).toEqual([]);
  });
});
