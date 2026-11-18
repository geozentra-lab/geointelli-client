import { createFeatureSelector } from '@ngrx/store';
import { RealtorDashboardState } from './realtor-dashboard.reducer';
export const selectRealtorDashboard =
  createFeatureSelector<RealtorDashboardState>('realtorDashboard');
