import { createFeatureSelector } from '@ngrx/store';
import { notificationPreferencesReducer } from './notification-preferences.reducer';
export const selectNotificationPreferences =
  createFeatureSelector<ReturnType<typeof notificationPreferencesReducer>>(
    'notificationPreferences',
  );
