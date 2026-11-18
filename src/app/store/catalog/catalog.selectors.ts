import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CatalogState } from './catalog.model';
export const selectCatalog = createFeatureSelector<CatalogState>('catalog');
export const selectVisibleProperties = createSelector(selectCatalog, (s) =>
  s.visibleIds.map((id) => s.entities[id]).filter((p) => p !== undefined),
);
