import { createFeatureSelector, createSelector } from '@ngrx/store';
import { propertyCompareReducer } from './property-compare.reducer';
export const selectPropertyCompare =
  createFeatureSelector<ReturnType<typeof propertyCompareReducer>>('propertyCompare');
export const selectCompareSelection = createSelector(selectPropertyCompare, (s) => s.selection);
