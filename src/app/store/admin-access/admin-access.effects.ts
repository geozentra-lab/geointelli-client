import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Action, Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  Observable,
  catchError,
  exhaustMap,
  filter,
  from,
  groupBy,
  map,
  mergeMap,
  switchMap,
  withLatestFrom,
} from 'rxjs';
import { Page } from '../../core/models/api';
import { ROLE_LABELS, ROLE_MANAGEMENT_UNAVAILABLE } from '../../core/models/account';
import { apiError } from '../../core/models/api-error';
import { AdminAccessService } from '../../data-access/admin-access.service';
import { SessionScopedEffects } from '../session-scoped-effects';
import { UiActions } from '../ui/ui.actions';
import { AdminAccessActions as A } from './admin-access.actions';
import { revokeKey } from './admin-access.reducer';
import { selectAdminAccess } from './admin-access.selectors';

/** Said when no account signs in with the email an admin looked up (404). */
export const NO_USER_FOR_EMAIL =
  'No GeoZentra account uses this email. An account appears once its owner has signed in.';

/** How a failed decision is told: the words, and whether the list is read again. */
export interface DecisionFailure {
  error: string;
  reload: boolean;
}
/**
 * 409: already decided (or no longer allowed): the backend's message as sent, and the list is read
 * again. 404: gone: said, and read again. 503: Keycloak role management is down, so nothing changed
 * and the item stays as it was. 400 and the rest: the usual wording (400 gives the backend's message).
 */
export function decisionFailure(e: unknown, notFound: string): DecisionFailure {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 503) return { error: ROLE_MANAGEMENT_UNAVAILABLE, reload: false };
    if (e.status === 409) return { error: apiError(e), reload: true };
    if (e.status === 404) return { error: notFound, reload: true };
  }
  return { error: apiError(e), reload: false };
}
/** A failure that reloads the list may take its row with it, so it is also said in a toast. */
const failureActions = (failed: Action, f: DecisionFailure): Action[] =>
  f.reload ? [failed, UiActions.toast({ message: f.error, kind: 'error' })] : [failed];

/** After a row left the page: the same page again, or the one before when it was the last row. */
function refillPage(page: number, value: Page<unknown> | null): number {
  return page > 0 && value !== null && value.content.length === 0 ? page - 1 : page;
}

@Injectable()
export class AdminAccessEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private store = inject(Store);
  private api = inject(AdminAccessService);
  private state$ = this.store.select(selectAdminAccess);

  roleRequests = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadRoleRequests),
      switchMap(({ query }) =>
        this.api.roleRequests(query).pipe(
          map((page) => A.roleRequestsLoaded({ page })),
          catchError((e) => from([A.roleRequestsFailed({ error: apiError(e) })])),
        ),
      ),
    ),
  );
  /**
   * exhaustMap per request: a double click sends one decision, and a decision on one request never
   * holds up or cancels one on another.
   */
  decideRoleRequest = createEffect(() =>
    this.actions.pipe(
      ofType(A.approveRoleRequest, A.rejectRoleRequest),
      withLatestFrom(this.state$),
      groupBy(([a]) => a.id),
      mergeMap((one) =>
        one.pipe(
          exhaustMap(([a, s]): Observable<Action> => {
            const row = s.requests.value?.content.find((r) => r.id === a.id);
            const approve = a.type === A.approveRoleRequest.type;
            const call =
              a.type === A.approveRoleRequest.type
                ? this.api.approveRoleRequest(a.id, a.reason)
                : this.api.rejectRoleRequest(a.id, a.reason);
            return call.pipe(
              mergeMap((request) => {
                const role = request?.role ?? row?.role;
                const email = request?.applicantEmail ?? row?.applicantEmail;
                const message = !approve
                  ? 'Request rejected.'
                  : role && email
                    ? `${ROLE_LABELS[role]} access approved for ${email}.`
                    : 'Request approved.';
                return [A.roleRequestDecided({ id: a.id, request }), UiActions.toast({ message })];
              }),
              catchError((e) => {
                const f = decisionFailure(e, 'This role request could not be found.');
                return from(failureActions(A.roleRequestDecisionFailed({ id: a.id, ...f }), f));
              }),
            );
          }),
        ),
      ),
    ),
  );
  /** The list is read again after a 409 or 404, and after a decided request left the page. */
  reloadRoleRequests = createEffect(() =>
    this.actions.pipe(
      ofType(A.roleRequestDecided, A.roleRequestDecisionFailed),
      withLatestFrom(this.state$),
      filter(([a, s]) =>
        a.type === A.roleRequestDecisionFailed.type
          ? a.reload
          : !!s.requests.value && !s.requests.value.content.some((r) => r.id === a.id),
      ),
      map(([, s]) =>
        A.loadRoleRequests({
          query: { ...s.requestQuery, page: refillPage(s.requestQuery.page, s.requests.value) },
        }),
      ),
    ),
  );

  licenses = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadLicenses),
      switchMap(({ query }) =>
        this.api.realtorLicenses(query).pipe(
          map((page) => A.licensesLoaded({ page })),
          catchError((e) => from([A.licensesFailed({ error: apiError(e) })])),
        ),
      ),
    ),
  );
  decideLicense = createEffect(() =>
    this.actions.pipe(
      ofType(A.approveLicense, A.rejectLicense),
      withLatestFrom(this.state$),
      groupBy(([a]) => a.id),
      mergeMap((one) =>
        one.pipe(
          exhaustMap(([a, s]): Observable<Action> => {
            const row = s.licenses.value?.content.find((r) => r.id === a.id);
            const approve = a.type === A.approveLicense.type;
            const call =
              a.type === A.approveLicense.type
                ? this.api.approveLicense(a.id, a.registrySource)
                : this.api.rejectLicense(a.id, a.registrySource, a.rejectionReason);
            return call.pipe(
              mergeMap((license) => {
                const email = license?.applicantEmail ?? row?.applicantEmail;
                const message = !approve
                  ? 'License rejected.'
                  : email
                    ? `Realtor access approved for ${email}.`
                    : 'License approved.';
                return [A.licenseDecided({ id: a.id, license }), UiActions.toast({ message })];
              }),
              catchError((e) => {
                const f = decisionFailure(e, 'This license submission could not be found.');
                return from(failureActions(A.licenseDecisionFailed({ id: a.id, ...f }), f));
              }),
            );
          }),
        ),
      ),
    ),
  );
  reloadLicenses = createEffect(() =>
    this.actions.pipe(
      ofType(A.licenseDecided, A.licenseDecisionFailed),
      withLatestFrom(this.state$),
      filter(([a, s]) =>
        a.type === A.licenseDecisionFailed.type
          ? a.reload
          : !!s.licenses.value && !s.licenses.value.content.some((r) => r.id === a.id),
      ),
      map(([, s]) =>
        A.loadLicenses({
          query: { ...s.licenseQuery, page: refillPage(s.licenseQuery.page, s.licenses.value) },
        }),
      ),
    ),
  );

  /** The newest lookup wins: an earlier answer for another email is dropped. */
  findUser = createEffect(() =>
    this.actions.pipe(
      ofType(A.findUser),
      switchMap(({ email }) =>
        this.api.findUser(email).pipe(
          map((user) => A.userFound({ email, user })),
          catchError((e) =>
            from([
              A.findUserFailed({
                email,
                error: e instanceof HttpErrorResponse && e.status === 404 ? NO_USER_FOR_EMAIL : apiError(e),
              }),
            ]),
          ),
        ),
      ),
    ),
  );
  roleGrants = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadRoleGrants),
      switchMap(({ userId }) =>
        this.api.roleGrants(userId).pipe(
          map((events) => A.roleGrantsLoaded({ userId, events })),
          catchError((e) => from([A.roleGrantsFailed({ userId, error: apiError(e) })])),
        ),
      ),
    ),
  );
  /** exhaustMap per user and role: a double click sends one revoke. */
  revoke = createEffect(() =>
    this.actions.pipe(
      ofType(A.revokeRole),
      groupBy((a) => revokeKey(a.userId, a.role)),
      mergeMap((one) =>
        one.pipe(
          exhaustMap(({ userId, role, reason }) =>
            this.api.revokeRole(userId, role, reason).pipe(
              mergeMap(() => [
                A.roleRevoked({ userId, role }),
                UiActions.toast({ message: `${ROLE_LABELS[role]} access revoked.` }),
              ]),
              catchError((e) => {
                const f = decisionFailure(e, 'This user or role could not be found.');
                return from(failureActions(A.revokeFailed({ userId, role, ...f }), f));
              }),
            ),
          ),
        ),
      ),
    ),
  );
  /** The history is read again after a revoke (or its 409 or 404), while that user is shown. */
  reloadRoleGrants = createEffect(() =>
    this.actions.pipe(
      ofType(A.roleRevoked, A.revokeFailed),
      withLatestFrom(this.state$),
      filter(
        ([a, s]) => s.grantsUserId === a.userId && (a.type === A.roleRevoked.type || a.reload),
      ),
      map(([a]) => A.loadRoleGrants({ userId: a.userId })),
    ),
  );
}
