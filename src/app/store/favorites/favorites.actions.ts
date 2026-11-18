import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { FavoriteDTO } from '../../core/models/api';
export const favoritesActions = createActionGroup({
  source: 'Favorites API',
  events: {
    Load: emptyProps(),
    'Load property': props<{ propertyId: number }>(),
    'Property loaded': props<{ propertyId: number }>(),
    'Property failed': props<{ propertyId: number; error: string }>(),
    Loaded: props<{ items: FavoriteDTO[] }>(),
    Add: props<{ propertyId: number }>(),
    Remove: props<{ propertyId: number }>(),
    Saved: props<{ item: FavoriteDTO }>(),
    Removed: props<{ propertyId: number }>(),
    Failed: props<{ error: string; propertyId?: number }>(),
  },
});
