import { createActionGroup, props } from '@ngrx/store';
import { MortgageRequest, MortgageResponse } from '../../core/models/api';
export const MortgageActions = createActionGroup({
  source: 'Mortgage API',
  events: {
    Calculate: props<{ request: MortgageRequest }>(),
    Calculated: props<{ response: MortgageResponse }>(),
    Failed: props<{ error: string }>(),
  },
});
