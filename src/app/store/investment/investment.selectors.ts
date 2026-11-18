import { createFeatureSelector, createSelector } from '@ngrx/store';
import { InvestmentState } from './investment.reducer';
export const selectInvestment = createFeatureSelector<InvestmentState>('investment');
export const selectActiveScenario = createSelector(
  selectInvestment,
  (s) => s.scenarios.value?.content.find((x) => x.id === s.activeId) ?? null,
);
