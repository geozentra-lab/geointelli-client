import { createReducer, on } from '@ngrx/store';
import { Page, UserDTO } from '../../core/models/api';
import {
  ProfessionalRole,
  RealtorLicenseReviewDTO,
  RoleGrantEventDTO,
  RoleRequestReviewDTO,
} from '../../core/models/account';
import { LicenseQuery, RoleRequestQuery } from '../../data-access/admin-access.service';
import { Remote, done, failed, idle, pending } from '../remote';
import { AdminAccessActions as A } from './admin-access.actions';

export type Decision = 'approve' | 'reject';

export interface AdminAccessState {
  requestQuery: RoleRequestQuery;
  requests: Remote<Page<RoleRequestReviewDTO>>;
  /** Requests with a decision on its way, by request ID. */
  requestActing: Record<number, Decision>;
  /** The last failed decision of each request, by request ID. */
  requestErrors: Record<number, string>;
  licenseQuery: LicenseQuery;
  licenses: Remote<Page<RealtorLicenseReviewDTO>>;
  licenseActing: Record<number, Decision>;
  licenseErrors: Record<number, string>;
  /** The email an admin last looked up, and the account found for it. */
  userLookupEmail: string | null;
  userLookup: Remote<UserDTO>;
  /** The user whose role history is held. */
  grantsUserId: number | null;
  grants: Remote<RoleGrantEventDTO[]>;
  /** Revokes on their way, by {@link revokeKey}. */
  revoking: Record<string, true>;
  revokeErrors: Record<string, string>;
}

/** A revoke is one user's one role. */
export const revokeKey = (userId: number, role: ProfessionalRole) => `${userId}:${role}`;

export const initialAdminAccessState: AdminAccessState = {
  requestQuery: { status: 'PENDING', role: null, page: 0 },
  requests: idle(),
  requestActing: {},
  requestErrors: {},
  licenseQuery: { status: 'PENDING_REVIEW', page: 0 },
  licenses: idle(),
  licenseActing: {},
  licenseErrors: {},
  userLookupEmail: null,
  userLookup: idle(),
  grantsUserId: null,
  grants: idle(),
  revoking: {},
  revokeErrors: {},
};

const without = <K extends string | number, V>(map: Record<K, V>, key: K): Record<K, V> => {
  const { [key]: _, ...rest } = map;
  return rest as Record<K, V>;
};

/**
 * A decided row: patched in place, or taken off the page when the list is filtered on a status it
 * no longer has (a pending request that was approved leaves the Pending list).
 */
function patchPage<T extends { id: number; status: string }>(
  page: Page<T> | null,
  row: T,
  filter: string | null,
): Page<T> | null {
  if (!page || !page.content.some((r) => r.id === row.id)) return page;
  if (filter !== null && row.status !== filter)
    return {
      ...page,
      content: page.content.filter((r) => r.id !== row.id),
      totalElements: Math.max(0, page.totalElements - 1),
    };
  return { ...page, content: page.content.map((r) => (r.id === row.id ? row : r)) };
}
const sameRequestQuery = (a: RoleRequestQuery, b: RoleRequestQuery) =>
  a.status === b.status && a.role === b.role;

export const adminAccessReducer = createReducer<AdminAccessState>(
  initialAdminAccessState,

  on(A.loadRoleRequests, (s, { query }) => {
    // Another page or a refresh keeps the rows on screen while it loads; another filter doesn't,
    // so rows are never shown under a filter they weren't read for.
    const same = sameRequestQuery(s.requestQuery, query);
    return {
      ...s,
      requestQuery: query,
      requests: pending(s.requests, same),
      requestErrors: same ? s.requestErrors : {},
    };
  }),
  on(A.roleRequestsLoaded, (s, { page }) => ({ ...s, requests: done(page) })),
  on(A.roleRequestsFailed, (s, { error }) => ({ ...s, requests: failed(s.requests, error) })),
  on(A.approveRoleRequest, A.rejectRoleRequest, (s, a) =>
    s.requestActing[a.id]
      ? s
      : {
          ...s,
          requestActing: {
            ...s.requestActing,
            [a.id]: a.type === A.approveRoleRequest.type ? 'approve' : 'reject',
          },
          requestErrors: without(s.requestErrors, a.id),
        },
  ),
  on(A.roleRequestDecided, (s, { id, request }) => {
    const before = s.requests.value?.content.find((r) => r.id === id);
    // The answer is the decided request; a missing status is read from the decision that was sent.
    const row: RoleRequestReviewDTO = {
      ...(before ?? ({} as RoleRequestReviewDTO)),
      ...request,
      id,
      status: request?.status ?? (s.requestActing[id] === 'reject' ? 'REJECTED' : 'APPROVED'),
    };
    const page = patchPage(s.requests.value, row, s.requestQuery.status);
    return {
      ...s,
      requestActing: without(s.requestActing, id),
      requests: page === s.requests.value ? s.requests : { ...s.requests, value: page },
    };
  }),
  on(A.roleRequestDecisionFailed, (s, { id, error }) => ({
    ...s,
    requestActing: without(s.requestActing, id),
    requestErrors: { ...s.requestErrors, [id]: error },
  })),

  on(A.loadLicenses, (s, { query }) => {
    const same = s.licenseQuery.status === query.status;
    return {
      ...s,
      licenseQuery: query,
      licenses: pending(s.licenses, same),
      licenseErrors: same ? s.licenseErrors : {},
    };
  }),
  on(A.licensesLoaded, (s, { page }) => ({ ...s, licenses: done(page) })),
  on(A.licensesFailed, (s, { error }) => ({ ...s, licenses: failed(s.licenses, error) })),
  on(A.approveLicense, A.rejectLicense, (s, a) =>
    s.licenseActing[a.id]
      ? s
      : {
          ...s,
          licenseActing: {
            ...s.licenseActing,
            [a.id]: a.type === A.approveLicense.type ? 'approve' : 'reject',
          },
          licenseErrors: without(s.licenseErrors, a.id),
        },
  ),
  on(A.licenseDecided, (s, { id, license }) => {
    const before = s.licenses.value?.content.find((r) => r.id === id);
    const row: RealtorLicenseReviewDTO = {
      ...(before ?? ({} as RealtorLicenseReviewDTO)),
      ...license,
      id,
      status: license?.status ?? (s.licenseActing[id] === 'reject' ? 'REJECTED' : 'VERIFIED'),
    };
    const page = patchPage(s.licenses.value, row, s.licenseQuery.status);
    return {
      ...s,
      licenseActing: without(s.licenseActing, id),
      licenses: page === s.licenses.value ? s.licenses : { ...s.licenses, value: page },
    };
  }),
  on(A.licenseDecisionFailed, (s, { id, error }) => ({
    ...s,
    licenseActing: without(s.licenseActing, id),
    licenseErrors: { ...s.licenseErrors, [id]: error },
  })),

  // A lookup answers only the email it was sent for; a newer one replaces it.
  on(A.findUser, (s, { email }) => ({
    ...s,
    userLookupEmail: email,
    userLookup: pending(idle<UserDTO>()),
  })),
  on(A.userFound, (s, { email, user }) =>
    email === s.userLookupEmail ? { ...s, userLookup: done(user) } : s,
  ),
  on(A.findUserFailed, (s, { email, error }) =>
    email === s.userLookupEmail ? { ...s, userLookup: failed(s.userLookup, error) } : s,
  ),

  on(A.loadRoleGrants, (s, { userId }) => ({
    ...s,
    grantsUserId: userId,
    // Another user's history is never shown while this one loads.
    grants: pending(s.grants, s.grantsUserId === userId),
  })),
  on(A.roleGrantsLoaded, (s, { userId, events }) =>
    userId === s.grantsUserId ? { ...s, grants: done(events) } : s,
  ),
  on(A.roleGrantsFailed, (s, { userId, error }) =>
    userId === s.grantsUserId ? { ...s, grants: failed(s.grants, error) } : s,
  ),
  on(A.revokeRole, (s, { userId, role }) => {
    const key = revokeKey(userId, role);
    return s.revoking[key]
      ? s
      : {
          ...s,
          revoking: { ...s.revoking, [key]: true as const },
          revokeErrors: without(s.revokeErrors, key),
        };
  }),
  on(A.roleRevoked, (s, { userId, role }) => ({
    ...s,
    revoking: without(s.revoking, revokeKey(userId, role)),
  })),
  on(A.revokeFailed, (s, { userId, role, error }) => {
    const key = revokeKey(userId, role);
    return {
      ...s,
      revoking: without(s.revoking, key),
      revokeErrors: { ...s.revokeErrors, [key]: error },
    };
  }),
);
