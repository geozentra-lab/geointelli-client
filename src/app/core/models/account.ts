import { RealtorLicenseStatus } from './api';
import { LenderOrganizationDTO } from './lender';

/**
 * Account types, onboarding and admin approval (backend SCRUM-204). The account type is the user's
 * Keycloak realm role: investor, realtor or lender, at most one per account; none is a home buyer.
 * Every account keeps the home-buyer experience; a professional role adds its own area. Roles are
 * read from the access token, so a newly granted one appears only after a token refresh.
 */
export type ProfessionalRole = 'investor' | 'realtor' | 'lender';
export const PROFESSIONAL_ROLES: readonly ProfessionalRole[] = ['investor', 'realtor', 'lender'];
export const ROLE_LABELS: Record<ProfessionalRole, string> = {
  investor: 'Investor',
  realtor: 'Realtor',
  lender: 'Lender',
};
/** The professional area each role adds (its menu section). */
export const AREA_LABELS: Record<ProfessionalRole, string> = {
  investor: 'Investments',
  realtor: 'CRM',
  lender: 'Lending',
};
export const HOME_BUYER = 'Home buyer';

export interface EntitlementFeatures {
  /** Home-buyer screens: every account. */
  normalUser: boolean;
  /** Investor screens. */
  investment: boolean;
  /** Realtor CRM. */
  realtorCrm: boolean;
  /** Lender screens. */
  lender: boolean;
  /** Admin screens (the backend gives an admin every other feature as well). */
  administration: boolean;
}
export type FeatureKey = keyof EntitlementFeatures;
/** The feature each professional role turns on. */
export const ROLE_FEATURE: Record<ProfessionalRole, FeatureKey> = {
  investor: 'investment',
  realtor: 'realtorCrm',
  lender: 'lender',
};

/** GET /api/users/me/entitlements: read after every login and every token refresh. */
export interface UserEntitlementsDTO {
  /** False until the onboarding page was answered: show it while false. */
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  /** Recognized realm roles of the token ("user" for every account, plus at most one professional role). */
  roles: string[];
  features: EntitlementFeatures;
  /** Roles waiting for an admin decision: investor, lender, or realtor while a license is pending review. */
  pendingRoles: string[];
  lenderOrganizations: LenderOrganizationDTO[];
  subscriptionPolicy?: string;
  scopeNote?: string;
}

export const isProfessionalRole = (role: string): role is ProfessionalRole =>
  (PROFESSIONAL_ROLES as readonly string[]).includes(role);
/** The account type: the professional role among the token's roles; null is a home buyer. */
export function accountTypeOf(roles: readonly string[] | null | undefined): ProfessionalRole | null {
  return roles?.find(isProfessionalRole) ?? null;
}
export function pendingRolesOf(e: UserEntitlementsDTO | null | undefined): ProfessionalRole[] {
  return (e?.pendingRoles ?? []).filter(isProfessionalRole);
}

/** Role requests are for investor and lender; a realtor submits a license instead. */
export type RequestableRole = 'investor' | 'lender';
export type RoleRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'REVOKED';
export interface RoleRequestDTO {
  id: number;
  role: RequestableRole;
  status: RoleRequestStatus;
  organizationName: string | null;
  note: string | null;
  /** The admin's reason, shown to the user after a rejection. */
  decisionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
}
export interface RoleRequestCreate {
  role: RequestableRole;
  /** Lender only, up to 160 characters. */
  organizationName?: string;
  /** Up to 1000 characters. */
  note?: string;
}

/** Admin review queue (GET /api/admin/role-requests). */
export interface RoleRequestReviewDTO {
  id: number;
  userId: number;
  applicantEmail: string;
  role: RequestableRole;
  status: RoleRequestStatus;
  organizationName: string | null;
  note: string | null;
  decisionReason: string | null;
  decidedByUserId: number | null;
  createdAt: string;
  decidedAt: string | null;
}

export type RoleGrantAction = 'GRANT' | 'REVOKE';
export type RoleGrantSource =
  | 'ROLE_REQUEST'
  | 'SELF_SERVICE'
  | 'REALTOR_LICENSE'
  | 'ADMIN_REVOCATION'
  | 'LICENSE_EXPIRY';
export const GRANT_SOURCE_LABELS: Record<RoleGrantSource, string> = {
  ROLE_REQUEST: 'Role request',
  SELF_SERVICE: 'Granted at sign-up',
  REALTOR_LICENSE: 'Realtor license',
  ADMIN_REVOCATION: 'Revoked by an admin',
  LICENSE_EXPIRY: 'License expired',
};
/**
 * GET /api/admin/users/search: an account suggested while an admin types. `id` opens its role
 * history; an account without an email or a name has null there.
 */
export interface UserSuggestionDTO {
  id: number;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

/** GET /api/admin/users/{userId}/role-grants, newest first. */
export interface RoleGrantEventDTO {
  id: number;
  userId: number;
  role: string;
  action: RoleGrantAction;
  source: RoleGrantSource;
  sourceId: number | null;
  reason: string | null;
  decidedByUserId: number | null;
  createdAt: string;
}

export type LicenseDecisionMethod = 'MANUAL' | 'AUTOMATIC';
export type LicenseAutoCheckResult = 'MATCH' | 'NO_MATCH' | 'INCONCLUSIVE';
/** Admin queue (GET /api/admin/realtor-license-verifications). */
export interface RealtorLicenseReviewDTO {
  id: number;
  applicantUserId: number;
  applicantEmail: string;
  licenseHolderName: string;
  licensingState: string;
  licenseNumber: string;
  licenseExpirationDate: string | null;
  brokerageName: string | null;
  workEmail: string | null;
  status: RealtorLicenseStatus;
  decisionMethod: LicenseDecisionMethod | null;
  reviewedByUserId: number | null;
  decidedAt: string | null;
  registrySource: string | null;
  rejectionReason: string | null;
  autoCheckResult: LicenseAutoCheckResult | null;
  autoCheckedAt: string | null;
  autoCheckSource: string | null;
  autoCheckNote: string | null;
  submittedAt: string;
}
/** The registry an admin checks a Florida license against; sent with every decision. */
export const DEFAULT_REGISTRY_SOURCE = 'Florida DBPR licensee search';

/** The admin role endpoints answer 503 when Keycloak role management can't be reached. */
export const ROLE_MANAGEMENT_UNAVAILABLE =
  'Keycloak role management is unavailable, nothing was changed. Try again later.';
