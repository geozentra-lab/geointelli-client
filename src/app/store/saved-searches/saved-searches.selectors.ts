import { createFeatureSelector } from '@ngrx/store';
import { savedSearchesAdapter, savedSearchesReducer } from './saved-searches.reducer';
export const selectSavedSearchesState =
  createFeatureSelector<ReturnType<typeof savedSearchesReducer>>('savedSearches');
export const { selectAll: selectSavedSearches } =
  savedSearchesAdapter.getSelectors(selectSavedSearchesState);
