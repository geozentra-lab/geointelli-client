import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { AlertsCard, FavoritesCard, SavedSearchesCard } from '../../core/models/api';
import { ActivityCardDTO } from '../../core/models/dashboard';
export type DashboardCardKey = 'favorites' | 'savedSearches' | 'alerts' | 'activity';
export const DashboardActions = createActionGroup({
  source: 'Dashboard API',
  events: {
    /** The buyer overview's cards: saved properties, saved searches, alerts and recent activity. */
    Load: emptyProps(),
    'Favorites loaded': props<{ card: FavoritesCard }>(),
    'Saved searches loaded': props<{ card: SavedSearchesCard }>(),
    'Alerts loaded': props<{ card: AlertsCard }>(),
    'Activity loaded': props<{ card: ActivityCardDTO }>(),
    'Card failed': props<{ card: DashboardCardKey; error: string }>(),
  },
});
