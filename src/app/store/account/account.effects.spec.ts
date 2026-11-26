import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Action, ActionsSubject, Store } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../index';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { RoleRequestDTO } from '../../core/models/account';
import { RealtorLicenseActions } from '../realtor-license/realtor-license.actions';
import { UiActions } from '../ui/ui.actions';
import { AccountActions as A } from './account.actions';
import { CHECK_EVERY_MS, outcomeOf } from './account.effects';
import { selectAccount } from './account.selectors';
import { entitlementsFor } from './account.testing';

const request = (over: Partial<RoleRequestDTO> = {}): RoleRequestDTO => ({
  id: 31,
  role: 'investor',
  status: 'PENDING',
  organizationName: null,
  note: null,
  decisionReason: null,
  createdAt: '2026-11-25T09:00:00Z',
  decidedAt: null,
  ...over,
});

describe('Account type, onboarding and approval (SCRUM-204)', () => {
  let store: Store;
  let http: HttpTestingController;
  let dispatched: Action[];
  const refreshNow = vi.fn(() => Promise.resolve(true));
  const of = (type: string) => dispatched.filter((a) => a.type === type);
  const state = () => store.selectSignal(selectAccount)();
  const entitlementsRequest = () => http.expectOne((r) => r.url.endsWith('/users/me/entitlements'));

  beforeEach(() => {
    vi.useFakeTimers();
    refreshNow.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => true, hasRealmRole: () => false, refreshNow } },
      ],
    });
    store = TestBed.inject(Store);
    http = TestBed.inject(HttpTestingController);
    dispatched = [];
    // Every action, the ones effects dispatch included.
    TestBed.inject(ActionsSubject).subscribe((a) => dispatched.push(a));
  });
  afterEach(() => vi.useRealTimers());

  it('reads the entitlements after sign-in and after every token refresh', () => {
    store.dispatch(A.loadEntitlements());
    entitlementsRequest().flush(entitlementsFor('lender'));
    expect(state().entitlements.value?.features.lender).toBe(true);
    store.dispatch(A.tokenRefreshed());
    entitlementsRequest().flush(entitlementsFor('buyer'));
    expect(state().entitlements.value?.features.lender).toBe(false);
  });

  it('home buyer: completes onboarding and takes the entitlements it answers with', () => {
    store.dispatch(A.continueAsHomeBuyer());
    const req = http.expectOne((r) => r.url.endsWith('/users/me/onboarding/complete'));
    expect(req.request.method).toBe('POST');
    req.flush(entitlementsFor('buyer'));
    expect(state().entitlements.value?.onboardingCompleted).toBe(true);
    expect(state().choosing).toBeNull();
  });

  it('a role request: PENDING re-reads the entitlements, APPROVED forces a new token first', async () => {
    store.dispatch(A.requestRole({ request: { role: 'lender', organizationName: 'Bayline Credit Union' } }));
    const sent = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/users/me/role-requests'));
    expect(sent.request.body).toEqual({ role: 'lender', organizationName: 'Bayline Credit Union' });
    sent.flush(request({ role: 'lender', organizationName: 'Bayline Credit Union' }));
    entitlementsRequest().flush(entitlementsFor('buyer', ['lender']));
    expect(refreshNow).not.toHaveBeenCalled();
    http.match((r) => r.url.endsWith('/users/me/role-requests')).forEach((r) => r.flush([request({ role: 'lender' })]));

    // Self-service roles are granted at once: a new token carries them.
    store.dispatch(A.requestRole({ request: { role: 'investor' } }));
    http
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/users/me/role-requests'))
      .flush(request({ id: 32, status: 'APPROVED' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshNow).toHaveBeenCalledTimes(1);
    entitlementsRequest().flush(entitlementsFor('investor'));
    expect(state().entitlements.value?.features.investment).toBe(true);
  });

  it('shows a 409 as the backend wrote it, and refreshes the token when the message asks for it', async () => {
    const message = 'Your account already has the investor role. Refresh the access token to see it.';
    store.dispatch(A.requestRole({ request: { role: 'investor' } }));
    http
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/users/me/role-requests'))
      .flush({ status: 409, error: 'Conflict', message }, { status: 409, statusText: 'Conflict' });
    expect(state().chooseError).toBe(message);
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshNow).toHaveBeenCalledTimes(1);
    entitlementsRequest().flush(entitlementsFor('investor'));
  });

  it('a realtor license answers onboarding too: the entitlements are read again', () => {
    store.dispatch(
      RealtorLicenseActions.submit({ request: { licenseHolderName: 'Dana Okafor', licensingState: 'FL', licenseNumber: 'SL1' } }),
    );
    http
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/users/me/realtor-license'))
      .flush({ id: 4, status: 'PENDING_REVIEW', submittedAt: '2026-11-25T09:00:00Z' });
    entitlementsRequest().flush(entitlementsFor('buyer', ['realtor']));
    expect(state().entitlements.value?.pendingRoles).toEqual(['realtor']);
  });

  it('while a role is pending: checks at once and every 2 minutes, without refreshing the token', async () => {
    store.dispatch(A.entitlementsLoaded({ entitlements: entitlementsFor('buyer', ['investor']) }));
    await vi.advanceTimersByTimeAsync(0);
    http.expectOne((r) => r.url.endsWith('/users/me/role-requests')).flush([request()]);
    expect(of(A.checkStatus.type)).toHaveLength(1);
    expect(state().checking).toBe(false);
    expect(state().checkedAt).not.toBeNull();
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    http.expectOne((r) => r.url.endsWith('/users/me/role-requests')).flush([request()]);
    expect(of(A.checkStatus.type)).toHaveLength(2);
    expect(refreshNow).not.toHaveBeenCalled();
    expect(state().notice).toBeNull();
    // Nothing pending any more: the checks stop.
    store.dispatch(A.entitlementsLoaded({ entitlements: entitlementsFor('buyer') }));
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS * 2);
    http.expectNone((r) => r.url.endsWith('/users/me/role-requests'));
  });

  it('after an approval, forces a new token, reads the entitlements and says the access is ready', async () => {
    store.dispatch(A.entitlementsLoaded({ entitlements: entitlementsFor('buyer', ['investor']) }));
    await vi.advanceTimersByTimeAsync(0);
    http.expectOne((r) => r.url.endsWith('/users/me/role-requests')).flush([request({ status: 'APPROVED' })]);
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshNow).toHaveBeenCalledTimes(1);
    entitlementsRequest().flush(entitlementsFor('investor'));
    expect(state().notice).toEqual({ kind: 'ready', role: 'investor', reason: null });
    expect(of(UiActions.toast.type)).toHaveLength(1);
    expect(state().entitlements.value?.features.investment).toBe(true);
  });

  it('after a rejection, keeps the reason to show and reads the entitlements, with no token refresh', async () => {
    store.dispatch(A.entitlementsLoaded({ entitlements: entitlementsFor('buyer', ['realtor']) }));
    await vi.advanceTimersByTimeAsync(0);
    http.expectOne((r) => r.url.endsWith('/users/me/realtor-license')).flush({
      id: 4,
      status: 'REJECTED',
      rejectionReason: 'The license number does not match the DBPR record',
    });
    expect(state().notice).toEqual({
      kind: 'rejected',
      role: 'realtor',
      reason: 'The license number does not match the DBPR record',
    });
    entitlementsRequest().flush(entitlementsFor('buyer'));
    expect(refreshNow).not.toHaveBeenCalled();
  });

  it('reads a never-submitted license (404) and a cancelled request as no longer pending', () => {
    expect(outcomeOf('realtor', null, null).status).toBe('withdrawn');
    expect(outcomeOf('lender', [request({ role: 'lender', status: 'CANCELLED' })], undefined).status).toBe('withdrawn');
    // The newest request of that role decides.
    expect(
      outcomeOf('investor', [request({ id: 9, status: 'REJECTED', decisionReason: 'No' }), request({ id: 3, status: 'APPROVED' })], undefined),
    ).toEqual({ role: 'investor', status: 'rejected', reason: 'No' });
  });

  it('cancels a pending request; a 409 (already decided) shows why and reads the requests again', () => {
    store.dispatch(A.cancelRoleRequest({ id: 31 }));
    http
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/users/me/role-requests/31/cancel'))
      .flush({ message: 'The request was already approved.' }, { status: 409, statusText: 'Conflict' });
    expect(state().cancelError).toBe('The request was already approved.');
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/users/me/role-requests')).flush([]);

    store.dispatch(A.cancelRoleRequest({ id: 31 }));
    http
      .expectOne((r) => r.url.endsWith('/users/me/role-requests/31/cancel'))
      .flush(request({ status: 'CANCELLED' }));
    entitlementsRequest().flush(entitlementsFor('buyer'));
    expect(state().cancelling).toBeNull();
  });

  it('rechecks the token after a 403, once per burst', async () => {
    store.dispatch(A.forbidden());
    store.dispatch(A.forbidden());
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshNow).toHaveBeenCalledTimes(1);
    entitlementsRequest().flush(entitlementsFor('buyer'));
  });
});
