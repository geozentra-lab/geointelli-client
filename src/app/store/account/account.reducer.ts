import { createReducer, on } from '@ngrx/store';
import {
  ProfessionalRole,
  RequestableRole,
  RoleRequestDTO,
  UserEntitlementsDTO,
} from '../../core/models/account';
import { Remote, done, failed, idle, pending } from '../remote';
import { RealtorLicenseActions } from '../realtor-license/realtor-license.actions';
import { AccountActions as A } from './account.actions';

/** What the last status check found, shown until dismissed: access ready, or a rejection's reason. */
export interface AccountNotice {
  kind: 'ready' | 'rejected';
  role: ProfessionalRole;
  reason: string | null;
}
export interface AccountState {
  entitlements: Remote<UserEntitlementsDTO>;
  /** The user's role requests, newest first. */
  roleRequests: Remote<RoleRequestDTO[]>;
  /** The choice being sent from the onboarding page or Settings ('realtor' is the license form). */
  choosing: 'buyer' | RequestableRole | 'realtor' | null;
  chooseError: string | null;
  cancelling: number | null;
  cancelError: string | null;
  checking: boolean;
  checkError: string | null;
  /** When the pending roles were last checked (ISO), to say so next to "Check status". */
  checkedAt: string | null;
  notice: AccountNotice | null;
}
export const initialAccount: AccountState = {
  entitlements: idle(),
  roleRequests: idle(),
  choosing: null,
  chooseError: null,
  cancelling: null,
  cancelError: null,
  checking: false,
  checkError: null,
  checkedAt: null,
  notice: null,
};

export const accountReducer = createReducer<AccountState>(
  initialAccount,
  // Not on Forbidden: its effect asks again at most every 30 s (and never for a guest), so a second
  // 403 sent no request and left the entitlements loading for good, and the area guards waited.
  on(A.loadEntitlements, A.tokenRefreshed, A.refreshToken, (s) => ({
    ...s,
    entitlements: pending(s.entitlements),
  })),
  on(A.entitlementsLoaded, (s, { entitlements }) => ({
    ...s,
    entitlements: done(entitlements),
    // The choice is answered once the entitlements show it (pending, granted or onboarding done).
    choosing: null,
  })),
  on(A.entitlementsFailed, (s, { error }) => ({ ...s, entitlements: failed(s.entitlements, error), choosing: null })),

  on(A.continueAsHomeBuyer, (s) => ({ ...s, choosing: 'buyer' as const, chooseError: null })),
  on(A.onboardingFailed, A.roleRequestFailed, (s, { error }) => ({ ...s, choosing: null, chooseError: error })),
  on(A.requestRole, (s, { request }) => ({ ...s, choosing: request.role, chooseError: null })),
  on(A.roleRequested, (s, { request }) => ({
    ...s,
    roleRequests: done([request, ...(s.roleRequests.value ?? []).filter((r) => r.id !== request.id)]),
    notice: null,
  })),
  on(RealtorLicenseActions.submit, (s) => ({ ...s, choosing: 'realtor' as const, chooseError: null })),
  on(RealtorLicenseActions.submitted, (s) => ({ ...s, notice: null })),
  on(RealtorLicenseActions.submitFailed, (s) => ({ ...s, choosing: null })),

  on(A.loadRoleRequests, (s) => ({ ...s, roleRequests: pending(s.roleRequests) })),
  on(A.roleRequestsLoaded, (s, { requests }) => ({ ...s, roleRequests: done(requests) })),
  on(A.roleRequestsFailed, (s, { error }) => ({ ...s, roleRequests: failed(s.roleRequests, error) })),
  on(A.cancelRoleRequest, (s, { id }) => ({ ...s, cancelling: id, cancelError: null })),
  on(A.roleRequestCancelled, (s, { request }) => ({
    ...s,
    cancelling: null,
    roleRequests: done((s.roleRequests.value ?? []).map((r) => (r.id === request.id ? request : r))),
  })),
  on(A.cancelFailed, (s, { error }) => ({ ...s, cancelling: null, cancelError: error })),

  on(A.checkStatus, (s) => ({ ...s, checking: true, checkError: null })),
  on(A.statusChecked, (s, { outcomes }) => {
    const ready = outcomes.find((o) => o.status === 'approved');
    const rejected = outcomes.find((o) => o.status === 'rejected');
    const decided = ready ?? rejected;
    return {
      ...s,
      checking: false,
      checkedAt: new Date().toISOString(),
      notice: decided
        ? { kind: ready ? ('ready' as const) : ('rejected' as const), role: decided.role, reason: decided.reason }
        : s.notice,
    };
  }),
  on(A.statusCheckFailed, (s, { error }) => ({ ...s, checking: false, checkError: error })),
  on(A.dismissNotice, (s) => ({ ...s, notice: null })),
);
