import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PROFESSIONAL_ROLES, ProfessionalRole, RoleGrantEventDTO } from '../../core/models/account';
import { AdminAccessState } from './admin-access.reducer';

export const selectAdminAccess = createFeatureSelector<AdminAccessState>('adminAccess');

export const selectRoleRequests = createSelector(selectAdminAccess, (s) => s.requests);
export const selectRealtorLicenses = createSelector(selectAdminAccess, (s) => s.licenses);
export const selectRoleGrants = createSelector(selectAdminAccess, (s) => s.grants);

/** A role the user holds now, with the grant that gave it. */
export interface CurrentRole {
  role: ProfessionalRole;
  grantedBy: RoleGrantEventDTO;
}

const newestFirst = (a: RoleGrantEventDTO, b: RoleGrantEventDTO) =>
  Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id;

/**
 * The professional roles a history says the user holds: each role whose newest event is a grant.
 * Worked out from the history only; a role given outside it doesn't appear.
 */
export function currentRoles(events: readonly RoleGrantEventDTO[]): CurrentRole[] {
  const sorted = [...events].sort(newestFirst);
  return PROFESSIONAL_ROLES.flatMap((role) => {
    const newest = sorted.find((e) => e.role?.toLowerCase() === role);
    return newest?.action === 'GRANT' ? [{ role, grantedBy: newest }] : [];
  });
}

/** The current roles of the user whose history is held; empty until it has loaded. */
export const selectCurrentRoles = createSelector(selectRoleGrants, (grants) =>
  currentRoles(grants.value ?? []),
);
