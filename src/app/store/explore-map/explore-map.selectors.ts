import { createFeatureSelector } from '@ngrx/store';
import { ExploreMapState } from './explore-map.reducer';

export const selectExploreMap = createFeatureSelector<ExploreMapState>('exploreMap');
