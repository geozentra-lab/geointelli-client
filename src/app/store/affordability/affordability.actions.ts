import { createActionGroup, props } from '@ngrx/store';
import { AffordabilityRequest, AffordabilityResponse } from '../../core/models/api';
export const AffordabilityActions = createActionGroup({
  source: 'Affordability API',
  events: {
    Calculate: props<{ request: AffordabilityRequest }>(),
    Calculated: props<{ response: AffordabilityResponse }>(),
    Failed: props<{ error: string }>(),
  },
});
