import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Parcel } from '../../core/models/parcel';
import { Property } from '../../core/models/property';
import { PropertySearchItem } from '../../core/models/api';
import { SearchQuery } from '../../core/models/search-query';
import { MapLayerDTO } from '../../data-access/map-layer.service';
export const PropertiesActions = createActionGroup({
  source: 'Properties API',
  events: {
    'Load parcels': props<{ bbox: string }>(),
    Search: props<{ query: SearchQuery }>(),
    'Parcels loaded': props<{ parcels: Parcel[]; folio: string | null }>(),
    Failed: props<{ error: string }>(),
    'Clear parcels': emptyProps(),
    'Load detail': props<{ folio: string; countyId: number }>(),
    'Detail loaded': props<{ property: Property }>(),
    'Detail failed': props<{ error: string }>(),
    Suggest: props<{ raw: string }>(),
    Suggested: props<{ suggestions: string[] }>(),
    /** Property cards for an address search; the first is shown on the map until one is chosen. */
    'Address matched': props<{ matches: PropertySearchItem[] }>(),
    'Folio not found': props<{ folio: string }>(),
    'Choose match': props<{ match: PropertySearchItem }>(),
    /** The chosen card has no parcel boundary on record, so there is nothing to draw. */
    'Match boundary missing': props<{ match: PropertySearchItem }>(),
    'Load layers': emptyProps(),
    /** An unavailable layer catalog is an empty one: the map only hides the source line. */
    'Layers loaded': props<{ layers: MapLayerDTO[] }>(),
  },
});
