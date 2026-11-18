import { createReducer, on } from '@ngrx/store';
import { RealtorLicenseVerificationDTO } from '../../core/models/realtor-license';
import { Remote, done, failed, idle, pending } from '../remote';
import { RealtorLicenseActions as A } from './realtor-license.actions';
export interface RealtorLicenseState {
  /** Every submission, newest first. */
  history: Remote<RealtorLicenseVerificationDTO[]>;
  submitting: boolean;
  submitError: string | null;
}
export const realtorLicenseReducer = createReducer<RealtorLicenseState>(
  { history: idle(), submitting: false, submitError: null },
  on(A.load, (s) => ({ ...s, history: pending(s.history) })),
  on(A.loaded, (s, { history }) => ({ ...s, history: done(history) })),
  on(A.loadFailed, (s, { error }) => ({ ...s, history: failed(s.history, error) })),
  on(A.submit, (s) => ({ ...s, submitting: true, submitError: null })),
  on(A.submitted, (s, { verification }) => ({
    ...s,
    submitting: false,
    history: done([verification, ...(s.history.value ?? [])]),
  })),
  on(A.submitFailed, (s, { error }) => ({ ...s, submitting: false, submitError: error })),
);
