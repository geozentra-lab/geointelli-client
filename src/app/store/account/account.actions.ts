import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  ProfessionalRole,
  RoleRequestCreate,
  RoleRequestDTO,
  UserEntitlementsDTO,
} from '../../core/models/account';

/** Where a pending role stands after a status check. */
export interface RoleOutcome {
  role: ProfessionalRole;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  /** The admin's reason, for a rejection. */
  reason: string | null;
}

/**
 * The account type, onboarding and approval of professional roles (backend SCRUM-204). Roles and
 * features come from the access token, so the entitlements are read after every login and every
 * token refresh.
 */
export const AccountActions = createActionGroup({
  source: 'Account',
  events: {
    'Load entitlements': emptyProps(),
    'Entitlements loaded': props<{ entitlements: UserEntitlementsDTO }>(),
    'Entitlements failed': props<{ error: string }>(),
    /** Keycloak issued a new token (scheduled refresh): read the entitlements again. */
    'Token refreshed': emptyProps(),
    /** Force a new token (after an approval, or when the backend asks for it), then read them again. */
    'Refresh token': emptyProps(),
    /** The backend answered 403 to a signed-in request: the token may predate a revocation. */
    Forbidden: emptyProps(),

    /** Onboarding: continue as a home buyer (no role). */
    'Continue as home buyer': emptyProps(),
    'Onboarding failed': props<{ error: string }>(),
    /** Onboarding or Settings: ask for the investor or lender role. */
    'Request role': props<{ request: RoleRequestCreate }>(),
    'Role requested': props<{ request: RoleRequestDTO }>(),
    'Role request failed': props<{ error: string }>(),

    'Load role requests': emptyProps(),
    'Role requests loaded': props<{ requests: RoleRequestDTO[] }>(),
    'Role requests failed': props<{ error: string }>(),
    'Cancel role request': props<{ id: number }>(),
    'Role request cancelled': props<{ request: RoleRequestDTO }>(),
    'Cancel failed': props<{ error: string }>(),

    /** While a role is pending: on app load, on "Check status" and every 2 minutes. */
    'Check status': emptyProps(),
    'Status checked': props<{ outcomes: RoleOutcome[] }>(),
    'Status check failed': props<{ error: string }>(),
    'Dismiss notice': emptyProps(),
  },
});
