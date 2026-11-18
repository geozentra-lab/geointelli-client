import { createActionGroup, props } from '@ngrx/store';
import { ComparableRequest, ComparableResponse } from '../../core/models/api';
export const ComparablesActions = createActionGroup({
  source: 'Comparables API',
  events: {
    Load: props<{ id: number; query: ComparableRequest }>(),
    Loaded: props<{ response: ComparableResponse }>(),
    Failed: props<{ error: string }>(),
  },
});
