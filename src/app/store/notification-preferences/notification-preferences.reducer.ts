import { createReducer, on } from '@ngrx/store';
import { NotificationPreferencesDTO } from '../../core/models/api';
import { NotificationPreferencesActions as A } from './notification-preferences.actions';
export const notificationPreferencesReducer = createReducer(
  {
    preferences: null as NotificationPreferencesDTO | null,
    loading: false,
    saving: false,
    error: null as string | null,
    errorOperation: null as 'load' | 'save' | null,
  },
  on(A.load, (s) => ({ ...s, loading: true, error: null })),
  on(A.loaded, (s, { preferences }) => ({ ...s, preferences, loading: false })),
  on(A.save, (s) => ({ ...s, saving: true, error: null })),
  on(A.saved, (s, { preferences }) => ({ ...s, preferences, saving: false })),
  on(A.failed, (s, { error, operation }) => ({
    ...s,
    error,
    errorOperation: operation,
    loading: operation === 'load' ? false : s.loading,
    saving: operation === 'save' ? false : s.saving,
  })),
);
