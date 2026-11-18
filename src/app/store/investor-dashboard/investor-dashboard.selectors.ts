import { createFeatureSelector, createSelector } from '@ngrx/store';
import { InvestorDashboardState } from './investor-dashboard.reducer';
export const selectInvestorDashboard =
  createFeatureSelector<InvestorDashboardState>('investorDashboard');
/**
 * The portfolio whose income and expenses can be shown: the one in scope, or the only one the user
 * has. null when the scope covers several portfolios.
 */
export const selectSummaryTarget = createSelector(selectInvestorDashboard, (s) => {
  if (s.portfolioId !== null) return s.portfolioId;
  const all = s.portfolios.value?.content ?? [];
  return all.length === 1 ? all[0].id : null;
});
