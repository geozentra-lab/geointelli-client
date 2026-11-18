import { createReducer, on } from '@ngrx/store';
import {
  AffordabilityCardDTO,
  AlertsCard,
  FavoritesCard,
  MortgageContextCardDTO,
  SavedSearchesCard,
} from '../../core/models/api';
import { ActivityCardDTO } from '../../core/models/dashboard';
import { Remote, cardDone, failed, idle, pending } from '../remote';
import { DashboardActions as A } from './dashboard.actions';
export interface DashboardState {
  favorites: Remote<FavoritesCard>;
  savedSearches: Remote<SavedSearchesCard>;
  alerts: Remote<AlertsCard>;
  activity: Remote<ActivityCardDTO>;
  affordability: Remote<AffordabilityCardDTO>;
  mortgageContext: Remote<MortgageContextCardDTO>;
}
export const dashboardReducer = createReducer<DashboardState>(
  {
    favorites: idle(),
    savedSearches: idle(),
    alerts: idle(),
    activity: idle(),
    affordability: idle(),
    mortgageContext: idle(),
  },
  // Cards keep what they show while they refresh, so the dashboard never flashes empty.
  on(A.load, (s) => ({
    ...s,
    favorites: pending(s.favorites),
    savedSearches: pending(s.savedSearches),
    alerts: pending(s.alerts),
    activity: pending(s.activity),
  })),
  on(A.favoritesLoaded, (s, { card }) => ({ ...s, favorites: cardDone(card) })),
  on(A.savedSearchesLoaded, (s, { card }) => ({ ...s, savedSearches: cardDone(card) })),
  on(A.alertsLoaded, (s, { card }) => ({ ...s, alerts: cardDone(card) })),
  on(A.activityLoaded, (s, { card }) => ({ ...s, activity: cardDone(card) })),
  on(A.loadAffordability, (s) => ({ ...s, affordability: pending(s.affordability) })),
  on(A.affordabilityLoaded, (s, { card }) => ({ ...s, affordability: cardDone(card) })),
  on(A.loadMortgageContext, (s) => ({ ...s, mortgageContext: pending(s.mortgageContext) })),
  on(A.mortgageContextLoaded, (s, { card }) => ({ ...s, mortgageContext: cardDone(card) })),
  on(A.cardFailed, (s, { card, error }) => ({ ...s, [card]: failed(s[card], error) })),
);
