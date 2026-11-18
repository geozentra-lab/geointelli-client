import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { StateDTO, CountyLocationDTO } from '../../core/models/location';
export const LocationsActions = createActionGroup({
  source: 'Locations API',
  events: {
    'Load states': emptyProps(),
    'States loaded': props<{ states: StateDTO[] }>(),
    'Select state': props<{ stateId: number | null }>(),
    'Counties loaded': props<{ counties: CountyLocationDTO[] }>(),
    'Select county': props<{ countyId: number | null }>(),
    Failed: props<{ error: string }>(),
    'Load counties for': props<{ stateId: number }>(),
    'Counties for loaded': props<{ stateId: number; counties: CountyLocationDTO[] }>(),
    'Counties for failed': props<{ stateId: number; error: string }>(),
  },
});
