import { createFeatureSelector } from '@ngrx/store';
import { OpportunitiesState } from './opportunities.reducer';
export const selectOpportunities = createFeatureSelector<OpportunitiesState>('opportunities');
