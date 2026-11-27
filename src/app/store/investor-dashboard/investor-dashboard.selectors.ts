import { createFeatureSelector } from '@ngrx/store';
import { InvestorDashboardState } from './investor-dashboard.reducer';
export const selectInvestorDashboard =
  createFeatureSelector<InvestorDashboardState>('investorDashboard');
