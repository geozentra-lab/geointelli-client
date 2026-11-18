import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { PropertyCompareResponse } from '../../core/models/api';
export const PropertyCompareActions = createActionGroup({
  source: 'Property compare',
  events: {
    Toggle: props<{ propertyId: number }>(),
    'Set selection': props<{ propertyIds: number[] }>(),
    Clear: emptyProps(),
    Load: emptyProps(),
    Loaded: props<{ response: PropertyCompareResponse }>(),
    Failed: props<{ error: string }>(),
  },
});
