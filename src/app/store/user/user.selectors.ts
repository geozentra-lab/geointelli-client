import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UserState } from './user.reducer';
export const selectUserState = createFeatureSelector<UserState>('user');
/** The account type is not here: it comes from the entitlements (store/account). */
export const selectUser = createSelector(selectUserState, (s) => ({
  name: s.profile?.firstName || s.profile?.username || '',
  budget: s.preferences?.maxBudget ?? null,
}));
