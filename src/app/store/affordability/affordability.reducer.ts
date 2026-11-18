import { createReducer, on } from '@ngrx/store';
import { AffordabilityRequest, AffordabilityResponse } from '../../core/models/api';
import { AffordabilityActions as A } from './affordability.actions';
export const affordabilityReducer = createReducer(
  {
    response: null as AffordabilityResponse | null,
    /** The last inputs, kept in memory only so the dashboard card can reuse them this session. */
    request: null as AffordabilityRequest | null,
    loading: false,
    error: null as string | null,
  },
  on(A.calculate, (s, { request }) => ({ ...s, request, loading: true, error: null })),
  on(A.calculated, (s, { response }) => ({ ...s, response, loading: false })),
  on(A.failed, (s, { error }) => ({ ...s, error, loading: false })),
);
