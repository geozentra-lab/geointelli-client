import { createFeatureSelector } from '@ngrx/store';
import { mortgageReducer } from './mortgage.reducer';
export const selectMortgage = createFeatureSelector<ReturnType<typeof mortgageReducer>>('mortgage');
