import { createFeatureSelector } from '@ngrx/store';
import { PropertiesState } from './properties.model';
export const selectProperties = createFeatureSelector<PropertiesState>('properties');
