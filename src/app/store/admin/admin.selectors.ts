import { createFeatureSelector } from '@ngrx/store';
import { AdminState } from './admin.reducer';
export const selectAdmin = createFeatureSelector<AdminState>('admin');
