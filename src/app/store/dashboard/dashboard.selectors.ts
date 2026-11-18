import { createFeatureSelector } from '@ngrx/store';
import { DashboardState } from './dashboard.reducer';
export const selectDashboard = createFeatureSelector<DashboardState>('dashboard');
