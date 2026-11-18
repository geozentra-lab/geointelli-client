import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { NotificationDTO, NotificationPage } from '../../core/models/notification';
export const NotificationsActions = createActionGroup({
  source: 'Notification API',
  events: {
    Load: emptyProps(),
    Loaded: props<{ page: NotificationPage }>(),
    Failed: props<{ error: string }>(),
    'Mark read': props<{ id: number }>(),
    'Read saved': props<{ item: NotificationDTO }>(),
    'Read failed': props<{ id: number; error: string }>(),
  },
});
