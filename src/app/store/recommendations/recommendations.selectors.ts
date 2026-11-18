import { createFeatureSelector } from '@ngrx/store';
import { recommendationsReducer } from './recommendations.reducer';
export const selectRecommendations =
  createFeatureSelector<ReturnType<typeof recommendationsReducer>>('recommendations');
