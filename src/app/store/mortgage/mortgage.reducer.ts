import { createReducer, on } from '@ngrx/store';
import { MortgageRequest, MortgageResponse } from '../../core/models/api';
import { MortgageActions as A } from './mortgage.actions';
export const mortgageReducer = createReducer(
  {
    response: null as MortgageResponse | null,
    /** The last inputs, kept in memory only so the dashboard card can reuse them this session. */
    request: null as MortgageRequest | null,
    loading: false,
    error: null as string | null,
  },
  on(A.calculate, (s, { request }) => ({
    ...s,
    request,
    response: null,
    loading: true,
    error: null,
  })),
  on(A.calculated, (s, { response }) => ({ ...s, response, loading: false })),
  on(A.failed, (s, { error }) => ({ ...s, error, loading: false })),
);
