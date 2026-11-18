import { createFeatureSelector } from '@ngrx/store';
import { alertsAdapter, alertsReducer } from './alerts.reducer';
export const selectAlertsState = createFeatureSelector<ReturnType<typeof alertsReducer>>('alerts');
export const { selectAll: selectAlerts } = alertsAdapter.getSelectors(selectAlertsState);
