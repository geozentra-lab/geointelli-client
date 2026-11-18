import { createFeatureSelector } from '@ngrx/store';
import { PropertyInsightsState } from './property-insights.reducer';
export const selectPropertyInsights =
  createFeatureSelector<PropertyInsightsState>('propertyInsights');
