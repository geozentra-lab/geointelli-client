import { createReducer, on } from '@ngrx/store';
import { PropertyCompareResponse } from '../../core/models/api';
import { PropertyCompareActions as A } from './property-compare.actions';
/** Mirrors the PropertyCompareRequest bounds on the backend. */
export const COMPARE_MIN = 2;
export const COMPARE_MAX = 5;
const bounded = (ids: number[]) =>
  [...new Set(ids)].filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, COMPARE_MAX);
export const propertyCompareReducer = createReducer(
  {
    selection: [] as number[],
    response: null as PropertyCompareResponse | null,
    loading: false,
    error: null as string | null,
  },
  on(A.toggle, (s, { propertyId }) => ({
    ...s,
    selection: s.selection.includes(propertyId)
      ? s.selection.filter((id) => id !== propertyId)
      : bounded([...s.selection, propertyId]),
  })),
  on(A.setSelection, (s, { propertyIds }) => ({ ...s, selection: bounded(propertyIds) })),
  on(A.clear, (s) => ({ ...s, selection: [], response: null, error: null })),
  on(A.load, (s) => ({ ...s, loading: true, error: null })),
  on(A.loaded, (s, { response }) => ({ ...s, response, loading: false })),
  on(A.failed, (s, { error }) => ({ ...s, error, loading: false })),
);
