import { createFeatureSelector, createSelector } from '@ngrx/store';
import { favoritesAdapter, favoritesReducer } from './favorites.reducer';
export const selectFavoriteState =
  createFeatureSelector<ReturnType<typeof favoritesReducer>>('favorites');
export const { selectAll: selectFavorites } = favoritesAdapter.getSelectors(selectFavoriteState);

/** Optimistic presentation stays separate from server-confirmed entities. */
export const selectVisibleFavorites = createSelector(
  selectFavoriteState,
  selectFavorites,
  (state, items) => {
    const visible = new Map(items.map((item) => [item.propertyId, item]));
    for (const [key, desired] of Object.entries(state.desired)) {
      const propertyId = Number(key);
      if (desired && !visible.has(propertyId))
        visible.set(propertyId, { propertyId, favorite: true, createdAt: '' });
      else if (!desired) visible.delete(propertyId);
    }
    return [...visible.values()];
  },
);
