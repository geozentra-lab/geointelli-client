import { createReducer, on } from '@ngrx/store';
import { ComparableResponse } from '../../core/models/api';
import { ComparablesActions as A } from './comparables.actions';
export const comparablesReducer = createReducer(
  {
    /** The property the response belongs to, so another page's results are never shown. */
    propertyId: null as number | null,
    response: null as ComparableResponse | null,
    loading: false,
    error: null as string | null,
  },
  on(A.load, (s, { id }) => ({ ...s, propertyId: id, response: null, loading: true, error: null })),
  on(A.loaded, (s, { response }) => ({ ...s, response, loading: false })),
  on(A.failed, (s, { error }) => ({ ...s, error, loading: false })),
);
