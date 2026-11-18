import { createReducer, on } from '@ngrx/store';
import { ValuationState } from './valuation.model';
import { ValuationActions as A } from './valuation.actions';
export const valuationReducer = createReducer<ValuationState>(
  {
    prediction: null,
    predictions: {},
    loading: false,
    bulkLoading: false,
    error: null,
    bulkError: null,
    detail: { propertyId: null, valuation: null, loading: false, error: null, notFound: false },
  },
  on(A.load, (s) => ({ ...s, prediction: null, loading: true, error: null })),
  on(A.loaded, (s, { prediction }) => ({ ...s, prediction, loading: false })),
  on(A.failed, (s, { error }) => ({ ...s, error, loading: false })),
  on(A.loadBulk, (s) => ({ ...s, bulkLoading: true, bulkError: null })),
  on(A.bulkLoaded, (s, { predictions }) => ({ ...s, predictions, bulkLoading: false })),
  on(A.bulkFailed, (s, { error }) => ({ ...s, bulkError: error, bulkLoading: false })),
  // A new property clears the previous one at once, so its numbers can never show under this one.
  on(A.loadDetail, (s, { propertyId }) => ({
    ...s,
    detail: { propertyId, valuation: null, loading: true, error: null, notFound: false },
  })),
  // A late answer for a property the page has moved away from is dropped.
  on(A.detailLoaded, (s, { propertyId, valuation }) =>
    propertyId !== s.detail.propertyId
      ? s
      : { ...s, detail: { ...s.detail, valuation, loading: false } },
  ),
  on(A.detailFailed, (s, { propertyId, error, notFound }) =>
    propertyId !== s.detail.propertyId
      ? s
      : { ...s, detail: { ...s.detail, error, notFound, loading: false } },
  ),
);
