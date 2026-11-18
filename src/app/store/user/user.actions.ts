import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { UserDTO, UserProfileUpdate, UserPreferencesDTO } from '../../core/models/api';
import { Persona } from './user.model';
export const UserActions = createActionGroup({
  source: 'User API',
  events: {
    Load: emptyProps(),
    Loaded: props<{ profile: UserDTO }>(),
    Failed: props<{ error: string }>(),
    'Change persona': props<{ role: Persona }>(),
    'Save profile': props<{ request: UserProfileUpdate }>(),
    'Profile saved': props<{ profile: UserDTO }>(),
    'Profile failed': props<{ error: string }>(),
    'Load preferences': emptyProps(),
    'Preferences load failed': props<{ error: string }>(),
    'Preferences loaded': props<{ preferences: UserPreferencesDTO }>(),
    'Save preferences': props<{ preferences: UserPreferencesDTO }>(),
    'Preferences saved': props<{ preferences: UserPreferencesDTO }>(),
    'Preferences failed': props<{ error: string }>(),
    'Signed out': emptyProps(),
  },
});
