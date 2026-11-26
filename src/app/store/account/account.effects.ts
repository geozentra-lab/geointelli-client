import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Action, Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  EMPTY,
  catchError,
  distinctUntilChanged,
  exhaustMap,
  filter,
  forkJoin,
  from,
  map,
  mergeMap,
  of,
  switchMap,
  throttleTime,
  throwError,
  timer,
  withLatestFrom,
} from 'rxjs';
import { AccountService } from '../../data-access/account.service';
import { RealtorLicenseService } from '../../data-access/realtor-license.service';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { apiError } from '../../core/models/api-error';
import { ProfessionalRole, ROLE_LABELS, RoleRequestDTO } from '../../core/models/account';
import { RealtorLicenseVerificationDTO } from '../../core/models/realtor-license';
import { RealtorLicenseActions } from '../realtor-license/realtor-license.actions';
import { SessionScopedEffects } from '../session-scoped-effects';
import { UiActions } from '../ui/ui.actions';
import { AccountActions as A, RoleOutcome } from './account.actions';
import { selectPendingRoles } from './account.selectors';

/** How often a pending role is checked while its banner is up (and on load and on "Check status"). */
export const CHECK_EVERY_MS = 2 * 60_000;
/** One 403 is enough to recheck the token; more of them while a page keeps asking change nothing. */
const FORBIDDEN_RECHECK_MS = 30_000;

/** A 409 from the backend can ask for a new access token (the role already changed on the server). */
export const asksForTokenRefresh = (message: string) => /refresh/i.test(message) && /token/i.test(message);

/** Where a pending role stands, from the newest request for it or the latest license submission. */
export function outcomeOf(
  role: ProfessionalRole,
  requests: RoleRequestDTO[] | null,
  license: RealtorLicenseVerificationDTO | null | undefined,
): RoleOutcome {
  if (role === 'realtor') {
    if (!license) return { role, status: 'withdrawn', reason: null };
    if (license.status === 'VERIFIED') return { role, status: 'approved', reason: null };
    if (license.status === 'REJECTED') return { role, status: 'rejected', reason: license.rejectionReason };
    return { role, status: 'pending', reason: null };
  }
  const newest = requests?.find((r) => r.role === role);
  if (!newest || newest.status === 'CANCELLED' || newest.status === 'REVOKED')
    return { role, status: 'withdrawn', reason: null };
  if (newest.status === 'APPROVED') return { role, status: 'approved', reason: null };
  if (newest.status === 'REJECTED') return { role, status: 'rejected', reason: newest.decisionReason };
  return { role, status: 'pending', reason: null };
}

@Injectable()
export class AccountEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private store = inject(Store);
  private api = inject(AccountService);
  private licenses = inject(RealtorLicenseService);
  private auth = inject(KeycloakService);

  /** switchMap: the newest read wins (a forced refresh and the refresh callback can both ask). */
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadEntitlements, A.tokenRefreshed),
      switchMap(() =>
        this.api.entitlements().pipe(
          map((entitlements) => A.entitlementsLoaded({ entitlements })),
          catchError((e) => of(A.entitlementsFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );

  /** A forced new token (updateToken(-1)) carries the roles granted since, then the entitlements are read. */
  refreshToken = createEffect(() =>
    this.actions.pipe(
      ofType(A.refreshToken),
      exhaustMap(() =>
        from(this.auth.refreshNow()).pipe(
          catchError(() => of(false)),
          map(() => A.loadEntitlements()),
        ),
      ),
    ),
  );
  forbidden = createEffect(() =>
    this.actions.pipe(
      ofType(A.forbidden),
      filter(() => this.auth.isLoggedIn()),
      throttleTime(FORBIDDEN_RECHECK_MS),
      map(() => A.refreshToken()),
    ),
  );

  continueAsHomeBuyer = createEffect(() =>
    this.actions.pipe(
      ofType(A.continueAsHomeBuyer),
      exhaustMap(() =>
        this.api.completeOnboarding().pipe(
          map((entitlements) => A.entitlementsLoaded({ entitlements })),
          catchError((e) => of(A.onboardingFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );

  /** exhaustMap: a double click sends one request, never a second one that would answer 409. */
  requestRole = createEffect(() =>
    this.actions.pipe(
      ofType(A.requestRole),
      exhaustMap(({ request }) =>
        this.api.requestRole(request).pipe(
          mergeMap((created): Action[] => [
            A.roleRequested({ request: created }),
            // Granted at once (self-service roles on the backend): a new token carries it.
            created.status === 'APPROVED' ? A.refreshToken() : A.loadEntitlements(),
          ]),
          catchError((e) => {
            const error = apiError(e);
            return of<Action[]>(
              A.roleRequestFailed({ error }),
              ...(asksForTokenRefresh(error) ? [A.refreshToken()] : []),
            );
          }),
        ),
      ),
    ),
  );

  /** A license submission answers the onboarding page and makes the realtor role pending. */
  licenseSubmitted = createEffect(() =>
    this.actions.pipe(
      ofType(RealtorLicenseActions.submitted),
      map(() => A.loadEntitlements()),
    ),
  );
  licenseConflict = createEffect(() =>
    this.actions.pipe(
      ofType(RealtorLicenseActions.submitFailed),
      filter(({ error }) => asksForTokenRefresh(error)),
      map(() => A.refreshToken()),
    ),
  );

  loadRoleRequests = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadRoleRequests),
      switchMap(() =>
        this.api.roleRequests().pipe(
          map((requests) => A.roleRequestsLoaded({ requests })),
          catchError((e) => of(A.roleRequestsFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );

  cancel = createEffect(() =>
    this.actions.pipe(
      ofType(A.cancelRoleRequest),
      exhaustMap(({ id }) =>
        this.api.cancelRoleRequest(id).pipe(
          mergeMap((request): Action[] => [
            A.roleRequestCancelled({ request }),
            A.loadEntitlements(),
            UiActions.toast({ message: `${ROLE_LABELS[request.role]} request cancelled.` }),
          ]),
          // 409: the admin decided first. Show why, and read the requests again to show the decision.
          catchError((e) => of<Action[]>(A.cancelFailed({ error: apiError(e) }), A.loadRoleRequests())),
        ),
      ),
    ),
  );

  /** While a role is pending: check at once (app load), then every 2 minutes, until none is pending. */
  poll = createEffect(() =>
    this.store.select(selectPendingRoles).pipe(
      map((roles) => roles.length > 0),
      distinctUntilChanged(),
      switchMap((waiting) =>
        waiting ? timer(0, CHECK_EVERY_MS).pipe(map(() => A.checkStatus())) : EMPTY,
      ),
    ),
  );

  /**
   * Reads where each pending role stands. Only an approval forces a new token (then the entitlements
   * are read with it); a rejection or a withdrawn request only needs the entitlements read again.
   */
  check = createEffect(() =>
    this.actions.pipe(
      ofType(A.checkStatus),
      withLatestFrom(this.store.select(selectPendingRoles)),
      exhaustMap(([, roles]) => {
        if (!roles.length) return of(A.statusChecked({ outcomes: [] }));
        const wantsRequests = roles.some((r) => r !== 'realtor');
        const wantsLicense = roles.includes('realtor');
        return forkJoin({
          requests: wantsRequests ? this.api.roleRequests() : of(null),
          license: wantsLicense
            ? this.licenses.latest().pipe(
                catchError((e) =>
                  e instanceof HttpErrorResponse && e.status === 404 ? of(null) : throwError(() => e),
                ),
              )
            : of(undefined),
        }).pipe(
          mergeMap(({ requests, license }) => {
            const outcomes = roles.map((role) => outcomeOf(role, requests, license));
            const out: Action[] = [];
            if (requests) out.push(A.roleRequestsLoaded({ requests }));
            out.push(A.statusChecked({ outcomes }));
            const approved = outcomes.find((o) => o.status === 'approved');
            if (approved) {
              out.push(A.refreshToken());
              out.push(UiActions.toast({ message: `Your ${ROLE_LABELS[approved.role].toLowerCase()} access is ready.` }));
            } else if (outcomes.some((o) => o.status !== 'pending')) out.push(A.loadEntitlements());
            return out;
          }),
          catchError((e) => of(A.statusCheckFailed({ error: apiError(e) }))),
        );
      }),
    ),
  );
}
