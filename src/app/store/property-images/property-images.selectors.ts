import { createFeatureSelector } from '@ngrx/store';
import { PropertyImagesState } from './property-images.model';
export const selectPropertyImages = createFeatureSelector<PropertyImagesState>('propertyImages');
