import { createFeatureSelector } from '@ngrx/store';
import { LocationsState } from './locations.model';
export const selectLocations = createFeatureSelector<LocationsState>('locations');
