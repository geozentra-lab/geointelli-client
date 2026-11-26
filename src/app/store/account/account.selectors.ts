import { createFeatureSelector, createSelector } from '@ngrx/store';
import {
  EntitlementFeatures,
  accountTypeOf,
  pendingRolesOf,
} from '../../core/models/account';
import { AccountState } from './account.reducer';

/** No feature until the entitlements say otherwise (guests, or before they load). */
export const NO_FEATURES: EntitlementFeatures = {
  normalUser: false,
  investment: false,
  realtorCrm: false,
  lender: false,
  administration: false,
};

export const selectAccount = createFeatureSelector<AccountState>('account');
export const selectEntitlements = createSelector(selectAccount, (s) => s.entitlements.value);
export const selectFeatures = createSelector(selectEntitlements, (e) => e?.features ?? NO_FEATURES);
/** The professional role the token carries; null is a home buyer. */
export const selectAccountType = createSelector(selectEntitlements, (e) => accountTypeOf(e?.roles));
export const selectPendingRoles = createSelector(selectEntitlements, (e) => pendingRolesOf(e));
/** Signed in and the onboarding page not answered yet. */
export const selectOnboardingNeeded = createSelector(
  selectEntitlements,
  (e) => !!e && !e.onboardingCompleted,
);
/** The newest role request still waiting for an admin (the one Cancel acts on). */
export const selectPendingRoleRequest = createSelector(
  selectAccount,
  (s) => s.roleRequests.value?.find((r) => r.status === 'PENDING') ?? null,
);
