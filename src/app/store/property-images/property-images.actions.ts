import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { PropertyImage } from '../../core/models/property-image';
export const PropertyImagesActions = createActionGroup({
  source: 'Property images API',
  events: {
    Load: props<{ propertyId: number }>(),
    Loaded: props<{ propertyId: number; images: PropertyImage[] }>(),
    Failed: props<{ propertyId: number; error: string }>(),
    Clear: emptyProps(),
  },
});
