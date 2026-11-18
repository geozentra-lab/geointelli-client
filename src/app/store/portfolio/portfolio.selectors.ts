import { createFeatureSelector, createSelector } from '@ngrx/store';
import { portfolioAdapter } from './portfolio.reducer';
import { PortfolioState } from './portfolio.model';
export const selectPortfolioState = createFeatureSelector<PortfolioState>('portfolio');
export const { selectAll: selectPortfolios } = portfolioAdapter.getSelectors(selectPortfolioState);
export const selectHoldings = createSelector(
  selectPortfolioState,
  (s) => s.holdingsPage?.content ?? [],
);
