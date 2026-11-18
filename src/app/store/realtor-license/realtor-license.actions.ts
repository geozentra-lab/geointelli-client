import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  RealtorLicenseSubmission,
  RealtorLicenseVerificationDTO,
} from '../../core/models/realtor-license';
export const RealtorLicenseActions = createActionGroup({
  source: 'Realtor license API',
  events: {
    Load: emptyProps(),
    Loaded: props<{ history: RealtorLicenseVerificationDTO[] }>(),
    'Load failed': props<{ error: string }>(),
    Submit: props<{ request: RealtorLicenseSubmission }>(),
    Submitted: props<{ verification: RealtorLicenseVerificationDTO }>(),
    'Submit failed': props<{ error: string }>(),
  },
});
