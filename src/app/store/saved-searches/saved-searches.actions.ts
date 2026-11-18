import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  Page,
  PropertySearchItem,
  SavedSearchDTO,
  SavedSearchRequest,
} from '../../core/models/api';
export const savedSearchesActions = createActionGroup({
  source: 'saved-searches API',
  events: {
    Load: props<{ page: number }>(),
    Loaded: props<{ page: Page<SavedSearchDTO> }>(),
    Create: props<{ request: SavedSearchRequest }>(),
    Update: props<{ id: number; request: SavedSearchRequest }>(),
    Remove: props<{ id: number }>(),
    Saved: props<{ item: SavedSearchDTO }>(),
    Removed: props<{ id: number }>(),
    Failed: props<{ error: string; operation: 'load' | 'save' }>(),
    /** Every saved search (up to the picker limit), for choosing an alert target. */
    'Load options': emptyProps(),
    'Options loaded': props<{ items: SavedSearchDTO[] }>(),
    'Options failed': props<{ error: string }>(),
    /** The properties a saved search matches today (GET /saved-searches/{id}/results). */
    'Load preview': props<{ id: number }>(),
    'Preview loaded': props<{ id: number; page: Page<PropertySearchItem> }>(),
    'Preview failed': props<{ id: number; error: string }>(),
    'Close preview': emptyProps(),
  },
});
