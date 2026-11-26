import { Store } from '@ngrx/store';
import { ProfessionalRole, UserEntitlementsDTO } from '../../core/models/account';
import { AccountActions } from './account.actions';

/** Specs only: an account as its entitlements describe it (the backend gives an admin every feature). */
export type TestAccount = 'buyer' | ProfessionalRole | 'admin';

export function entitlementsFor(
  account: TestAccount,
  pending: ProfessionalRole[] = [],
  onboarded = true,
): UserEntitlementsDTO {
  const admin = account === 'admin';
  const role = account === 'buyer' || account === 'admin' ? null : account;
  return {
    onboardingCompleted: onboarded,
    onboardingCompletedAt: onboarded ? '2026-11-20T10:00:00Z' : null,
    roles: ['user', ...(role ? [role] : []), ...(admin ? ['admin'] : [])],
    features: {
      normalUser: true,
      investment: admin || role === 'investor',
      realtorCrm: admin || role === 'realtor',
      lender: admin || role === 'lender',
      administration: admin,
    },
    pendingRoles: pending,
    lenderOrganizations: [],
  };
}

/** Puts an account type into a spec's store, as if its entitlements had just been read. */
export function actAs(store: Store, account: TestAccount, pending: ProfessionalRole[] = []) {
  store.dispatch(AccountActions.entitlementsLoaded({ entitlements: entitlementsFor(account, pending) }));
}
