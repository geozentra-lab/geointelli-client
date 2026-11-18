import { createReducer, on } from '@ngrx/store';
import { ContactProfessionalDTO, ContactResponseDTO } from '../../core/models/contact';
import { ContactRequestsActions as A } from './contact-requests.actions';
export const contactRequestsReducer = createReducer(
  {
    professionals: [] as ContactProfessionalDTO[],
    professionalsLoaded: false,
    professionalsLoading: false,
    professionalsError: null as string | null,
    submitting: false,
    submitError: null as string | null,
    /** Latest saved request per property, so the page can confirm it after navigation. */
    sent: {} as Record<number, ContactResponseDTO>,
  },
  on(A.loadProfessionals, (s) => ({ ...s, professionalsLoading: true, professionalsError: null })),
  on(A.professionalsLoaded, (s, { professionals }) => ({
    ...s,
    professionals,
    professionalsLoaded: true,
    professionalsLoading: false,
  })),
  on(A.professionalsFailed, (s, { error }) => ({
    ...s,
    professionalsError: error,
    professionalsLoading: false,
  })),
  on(A.submit, (s) => ({ ...s, submitting: true, submitError: null })),
  on(A.submitted, (s, { response }) => ({
    ...s,
    submitting: false,
    sent: { ...s.sent, [response.propertyId]: response },
  })),
  on(A.submitFailed, (s, { error }) => ({ ...s, submitting: false, submitError: error })),
);
