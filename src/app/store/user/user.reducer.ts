import { createReducer, on } from '@ngrx/store';
import { UserDTO, UserPreferencesDTO } from '../../core/models/api';
import { UserActions as A } from './user.actions';
import { RealtorLicenseActions } from '../realtor-license/realtor-license.actions';
export interface UserState {
  profile: UserDTO | null;
  preferences: UserPreferencesDTO | null;
  loading: boolean;
  savingProfile: boolean;
  profileError: string | null;
  savingPreferences: boolean;
  error: string | null;
  preferencesError: string | null;
  /** Loading failed: the form holds defaults, so it must not be saved over the server copy. */
  preferencesLoadError: string | null;
}
const initial: UserState = {
  profile: null,
  preferences: null,
  loading: false,
  savingProfile: false,
  profileError: null,
  savingPreferences: false,
  error: null,
  preferencesError: null,
  preferencesLoadError: null,
};
export const userReducer = createReducer(
  initial,
  on(A.load, (s) => ({ ...s, loading: true, error: null })),
  on(A.loaded, (s, { profile }) => ({ ...s, profile, loading: false, error: null })),
  on(A.failed, (s, { error }) => ({
    ...s,
    profile: null,
    preferences: null,
    error,
    loading: false,
  })),
  on(A.saveProfile, (s) => ({ ...s, savingProfile: true, profileError: null })),
  on(A.profileSaved, (s, { profile }) => ({
    ...s,
    profile,
    savingProfile: false,
    profileError: null,
  })),
  on(A.profileFailed, (s, { error }) => ({ ...s, profileError: error, savingProfile: false })),
  // The profile carries the newest license status; a new submission is that status now.
  on(RealtorLicenseActions.submitted, (s, { verification }) =>
    s.profile ? { ...s, profile: { ...s.profile, realtorLicenseStatus: verification.status } } : s,
  ),
  on(A.loadPreferences, (s) => ({ ...s, preferencesError: null, preferencesLoadError: null })),
  on(A.preferencesLoadFailed, (s, { error }) => ({ ...s, preferencesLoadError: error })),
  on(A.preferencesLoaded, (s, { preferences }) => ({
    ...s,
    preferences,
    preferencesError: null,
    preferencesLoadError: null,
  })),
  on(A.savePreferences, (s) => ({ ...s, savingPreferences: true, preferencesError: null })),
  on(A.preferencesSaved, (s, { preferences }) => ({ ...s, preferences, savingPreferences: false })),
  on(A.preferencesFailed, (s, { error }) => ({
    ...s,
    preferencesError: error,
    savingPreferences: false,
  })),
  on(A.signedOut, () => initial),
);
