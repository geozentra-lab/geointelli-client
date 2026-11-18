import { createFeatureSelector, createSelector } from '@ngrx/store';
import { LenderState } from './lender.reducer';
export const selectLender = createFeatureSelector<LenderState>('lender');
export const selectLenderOrganization = createSelector(
  selectLender,
  (s) => s.organizations.find((o) => o.id === s.selectedId) ?? null,
);
