import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  AffordabilityCardDTO,
  AffordabilityRequest,
  AlertsCard,
  FavoritesCard,
  MortgageContextCardDTO,
  MortgageRequest,
  SavedSearchesCard,
} from '../../core/models/api';
import { ActivityCardDTO } from '../../core/models/dashboard';
export type DashboardCardKey =
  | 'favorites'
  | 'savedSearches'
  | 'alerts'
  | 'activity'
  | 'affordability'
  | 'mortgageContext';
export const DashboardActions = createActionGroup({
  source: 'Dashboard API',
  events: {
    /** The user cards every account shows: favorites, saved searches, alerts and activity. */
    Load: emptyProps(),
    'Favorites loaded': props<{ card: FavoritesCard }>(),
    'Saved searches loaded': props<{ card: SavedSearchesCard }>(),
    'Alerts loaded': props<{ card: AlertsCard }>(),
    'Activity loaded': props<{ card: ActivityCardDTO }>(),
    /** Inputs are the ones last used in Investment Studio; nothing is assumed when there are none. */
    'Load affordability': props<{ inputs: Partial<AffordabilityRequest> }>(),
    'Affordability loaded': props<{ card: AffordabilityCardDTO }>(),
    'Load mortgage context': props<{ inputs: Partial<MortgageRequest> }>(),
    'Mortgage context loaded': props<{ card: MortgageContextCardDTO }>(),
    'Card failed': props<{ card: DashboardCardKey; error: string }>(),
  },
});
