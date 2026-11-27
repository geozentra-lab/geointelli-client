import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Page, UserDTO } from '../../core/models/api';
import {
  ProfessionalRole,
  RealtorLicenseReviewDTO,
  RoleGrantEventDTO,
  RoleRequestReviewDTO,
  UserSuggestionDTO,
} from '../../core/models/account';
import { LicenseQuery, RoleRequestQuery } from '../../data-access/admin-access.service';

/**
 * Account-type approval (admin): role requests, realtor licenses and a user's role history. A
 * decision's failure says whether the list was read again (`reload`: 409 already decided, 404 gone).
 */
export const AdminAccessActions = createActionGroup({
  source: 'Admin access API',
  events: {
    'Load role requests': props<{ query: RoleRequestQuery }>(),
    'Role requests loaded': props<{ page: Page<RoleRequestReviewDTO> }>(),
    'Role requests failed': props<{ error: string }>(),
    /** One decision per request at a time: a second click on the same request is dropped. */
    'Approve role request': props<{ id: number; reason: string | null }>(),
    'Reject role request': props<{ id: number; reason: string }>(),
    'Role request decided': props<{ id: number; request: RoleRequestReviewDTO }>(),
    'Role request decision failed': props<{ id: number; error: string; reload: boolean }>(),

    'Load licenses': props<{ query: LicenseQuery }>(),
    'Licenses loaded': props<{ page: Page<RealtorLicenseReviewDTO> }>(),
    'Licenses failed': props<{ error: string }>(),
    'Approve license': props<{ id: number; registrySource: string }>(),
    'Reject license': props<{ id: number; registrySource: string; rejectionReason: string }>(),
    'License decided': props<{ id: number; license: RealtorLicenseReviewDTO }>(),
    'License decision failed': props<{ id: number; error: string; reload: boolean }>(),

    /** An account by the email it signs in with, to open its role history. */
    'Find user': props<{ email: string }>(),
    'User found': props<{ email: string; user: UserDTO }>(),
    'Find user failed': props<{ email: string; error: string }>(),
    /**
     * Suggestions for the email or name an admin is typing: sent after a pause in typing (at once
     * with `immediate`), from 2 characters; the newest text wins. Closed when the list goes away.
     */
    'Search users': props<{ query: string; immediate?: boolean }>(),
    'Users suggested': props<{ query: string; users: UserSuggestionDTO[] }>(),
    'Search users failed': props<{ query: string; error: string }>(),
    'Search users closed': emptyProps(),

    'Load role grants': props<{ userId: number }>(),
    'Role grants loaded': props<{ userId: number; events: RoleGrantEventDTO[] }>(),
    'Role grants failed': props<{ userId: number; error: string }>(),
    'Revoke role': props<{ userId: number; role: ProfessionalRole; reason: string }>(),
    'Role revoked': props<{ userId: number; role: ProfessionalRole }>(),
    'Revoke failed': props<{
      userId: number;
      role: ProfessionalRole;
      error: string;
      reload: boolean;
    }>(),
  },
});
