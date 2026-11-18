import { createFeatureSelector, createSelector } from '@ngrx/store';
import { NotificationsState } from './notifications.model';
export const selectNotifications = createFeatureSelector<NotificationsState>('notifications');
export const selectUnreadNotifications = createSelector(selectNotifications, (s) =>
  s.items.some((item) => !item.read),
);
