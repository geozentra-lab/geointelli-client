import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ValuationState } from './valuation.model';
export const selectValuation = createFeatureSelector<ValuationState>('valuation');
export const selectValuationDetail = createSelector(selectValuation, (s) => s.detail);
