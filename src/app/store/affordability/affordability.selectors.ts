import { createFeatureSelector } from '@ngrx/store';
import { affordabilityReducer } from './affordability.reducer';
export const selectAffordability =
  createFeatureSelector<ReturnType<typeof affordabilityReducer>>('affordability');
