import { createFeatureSelector } from '@ngrx/store';
import { comparablesReducer } from './comparables.reducer';
export const selectComparables =
  createFeatureSelector<ReturnType<typeof comparablesReducer>>('comparables');
