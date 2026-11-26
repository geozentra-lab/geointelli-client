import { createActionGroup, props } from '@ngrx/store';
import { Placement } from '../../shared/data/parcel-geometry';

/** A search result to put on the Explore map: found by folio and county (search rows carry no coordinates). */
export interface PlaceTarget {
  propertyId: number;
  folio: string;
  countyId: number;
}

export const ExploreMapActions = createActionGroup({
  source: 'Explore map',
  events: {
    /**
     * Look up the parcels of these properties (the results on screen) to place them on the map.
     * Properties already placed are skipped and a failed lookup is tried again. It replaces the
     * lookups still pending for the page before.
     */
    'Place properties': props<{ targets: PlaceTarget[] }>(),
    /** placement is null when no parcel boundary is on record for the folio (the API answers 404). */
    'Placement found': props<{ propertyId: number; placement: Placement | null }>(),
    /** The lookup failed for another reason; the property is not marked as having no boundary. */
    'Placement failed': props<{ propertyId: number }>(),
  },
});
