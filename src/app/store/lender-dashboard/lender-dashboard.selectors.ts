import { createFeatureSelector } from '@ngrx/store';
import { LenderDashboardState } from './lender-dashboard.reducer';
export const selectLenderDashboard = createFeatureSelector<LenderDashboardState>('lenderDashboard');
