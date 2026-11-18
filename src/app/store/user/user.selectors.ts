import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UserState } from './user.reducer';
import { Persona } from './user.model';
import { BackendPersona } from '../../core/models/api';
export const personaNames: Record<BackendPersona, Persona> = {
  USER: 'Buyer',
  RESIDENTIAL_INVESTOR: 'Investor',
  REALTOR: 'Realtor',
  BANK_LENDER: 'Lender',
};
export const backendPersonas: Record<Persona, BackendPersona> = {
  Buyer: 'USER',
  Investor: 'RESIDENTIAL_INVESTOR',
  Realtor: 'REALTOR',
  Lender: 'BANK_LENDER',
};
export const selectUserState = createFeatureSelector<UserState>('user');
export const selectUser = createSelector(selectUserState, (s) => ({
  name: s.profile?.firstName || s.profile?.username || '',
  role: s.profile ? personaNames[s.profile.persona] : ('Buyer' as Persona),
  budget: s.preferences?.maxBudget ?? null,
}));
