import { createActionGroup, props } from '@ngrx/store';
import { RecommendationResponse } from '../../core/models/api';
export const RecommendationsActions = createActionGroup({
  source: 'Recommendations API',
  events: {
    Load: props<{ limit: number }>(),
    Loaded: props<{ response: RecommendationResponse }>(),
    Failed: props<{ error: string }>(),
  },
});
