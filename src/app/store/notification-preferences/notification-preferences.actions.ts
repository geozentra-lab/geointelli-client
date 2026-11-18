import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { NotificationPreferencesDTO, NotificationPreferencesRequest } from '../../core/models/api';
export const NotificationPreferencesActions = createActionGroup({
  source: 'Notification preferences API',
  events: {
    Load: emptyProps(),
    Loaded: props<{ preferences: NotificationPreferencesDTO }>(),
    Save: props<{ request: NotificationPreferencesRequest }>(),
    Saved: props<{ preferences: NotificationPreferencesDTO }>(),
    Failed: props<{ error: string; operation: 'load' | 'save' }>(),
  },
});
