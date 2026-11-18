import { StateDTO, CountyLocationDTO } from '../../core/models/location';
export interface LocationsState {
  states: StateDTO[];
  counties: CountyLocationDTO[];
  stateId: number | null;
  countyId: number | null;
  loading: boolean;
  error: string | null;
  /**
   * Counties per state for pickers with a selection of their own (the map search), so choosing
   * there never changes the shared Explore filter.
   */
  countiesByState: Record<
    number,
    { counties: CountyLocationDTO[]; loading: boolean; error: string | null }
  >;
}
