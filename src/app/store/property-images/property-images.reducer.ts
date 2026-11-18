import { createReducer, on } from '@ngrx/store';
import { PropertyImagesState } from './property-images.model';
import { PropertyImagesActions as A } from './property-images.actions';
const initial: PropertyImagesState = { propertyId: null, images: [], loading: false, error: null };
export const propertyImagesReducer = createReducer(
  initial,
  on(A.load, (_, { propertyId }) => ({ ...initial, propertyId, loading: true })),
  on(A.loaded, (s, { propertyId, images }) =>
    s.propertyId === propertyId ? { ...s, images, loading: false } : s,
  ),
  on(A.failed, (s, { propertyId, error }) =>
    s.propertyId === propertyId ? { ...s, error, loading: false } : s,
  ),
  on(A.clear, () => initial),
);
