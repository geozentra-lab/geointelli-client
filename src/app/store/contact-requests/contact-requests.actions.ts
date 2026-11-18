import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  ContactProfessionalDTO,
  ContactResponseDTO,
  PropertyContactRequest,
} from '../../core/models/contact';
export const ContactRequestsActions = createActionGroup({
  source: 'Contact requests API',
  events: {
    'Load professionals': emptyProps(),
    'Professionals loaded': props<{ professionals: ContactProfessionalDTO[] }>(),
    'Professionals failed': props<{ error: string }>(),
    Submit: props<{ request: PropertyContactRequest; idempotencyKey: string }>(),
    Submitted: props<{ response: ContactResponseDTO }>(),
    'Submit failed': props<{ error: string }>(),
  },
});
