import { createReducer, on } from '@ngrx/store';
import { RecommendationResponse } from '../../core/models/api';
import { RecommendationsActions as A } from './recommendations.actions';
import { UserActions } from '../user/user.actions';
export const recommendationsReducer = createReducer(
  {
    response: null as RecommendationResponse | null,
    loading: false,
    error: null as string | null,
    limit: 20,
  },
  // Previous suggestions stay visible while refreshing so the list does not flash empty.
  on(A.load, (s, { limit }) => ({ ...s, limit, loading: true, error: null })),
  on(A.loaded, (s, { response }) => ({ ...s, response, loading: false })),
  on(A.failed, (s, { error }) => ({ ...s, error, loading: false })),
  // Saved preferences drive the results; drop them so the next visit reloads.
  on(UserActions.preferencesSaved, (s) => ({ ...s, response: null })),
);
