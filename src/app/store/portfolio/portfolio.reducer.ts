import { createEntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { PortfolioDTO, HoldingDTO } from '../../core/models/api';
import { PortfolioState } from './portfolio.model';
import { portfolioActions as A } from './portfolio.actions';
export const portfolioAdapter = createEntityAdapter<PortfolioDTO>();
export const holdingsAdapter = createEntityAdapter<HoldingDTO>();
const initial = portfolioAdapter.getInitialState<PortfolioState>({
  summaryQuery: {},
  recordsQuery: {},
  page: null,
  selectedId: null,
  holdings: holdingsAdapter.getInitialState(),
  holdingsPage: null,
  selectedHoldingId: null,
  summary: null,
  records: null,
  loading: false,
  holdingsLoading: false,
  summaryLoading: false,
  recordsLoading: false,
  saving: 0,
  errors: {},
});
export const portfolioReducer = createReducer(
  initial,
  on(A.load, (s) => ({ ...s, loading: true, errors: { ...s.errors, list: undefined } })),
  on(A.loaded, (s, { page }) =>
    portfolioAdapter.setAll(page.content, { ...s, page, loading: false }),
  ),
  on(A.select, (s, { id }) => ({
    ...s,
    selectedId: id,
    summaryQuery: {},
    recordsQuery: {},
    holdings: holdingsAdapter.getInitialState(),
    holdingsPage: null,
    selectedHoldingId: null,
    records: null,
    summary: null,
    errors: {},
    holdingsLoading: false,
    summaryLoading: false,
    recordsLoading: false,
  })),
  on(A.loadHoldings, (s) => ({
    ...s,
    holdingsLoading: true,
    errors: { ...s.errors, holdings: undefined },
  })),
  on(A.holdingsLoaded, (s, { id, page }) =>
    id === s.selectedId
      ? {
          ...s,
          holdings: holdingsAdapter.setAll(page.content, s.holdings),
          holdingsPage: page,
          holdingsLoading: false,
        }
      : s,
  ),
  on(A.loadSummary, (s, { fromDate, toDate }) => ({
    ...s,
    summaryQuery: { fromDate, toDate },
    summaryLoading: true,
    errors: { ...s.errors, summary: undefined },
  })),
  on(A.summaryLoaded, (s, { id, summary }) =>
    id === s.selectedId ? { ...s, summary, summaryLoading: false } : s,
  ),
  on(A.selectHolding, (s, { holdingId }) => ({
    ...s,
    selectedHoldingId: holdingId,
    recordsQuery: {},
    records: null,
    recordsLoading: false,
  })),
  on(A.loadRecords, (s, { fromDate, toDate }) => ({
    ...s,
    recordsQuery: { fromDate, toDate },
    recordsLoading: true,
    errors: { ...s.errors, records: undefined },
  })),
  on(A.recordsLoaded, (s, { id, holdingId, page }) =>
    id === s.selectedId && holdingId === s.selectedHoldingId
      ? { ...s, records: page, recordsLoading: false }
      : s,
  ),
  on(A.mutate, (s) => ({ ...s, saving: s.saving + 1, errors: { ...s.errors, save: undefined } })),
  on(A.mutationSucceeded, (s) => ({ ...s, saving: Math.max(0, s.saving - 1) })),
  on(A.failed, (s, { section, error }) => ({
    ...s,
    errors: { ...s.errors, [section]: error },
    loading: section === 'list' ? false : s.loading,
    holdingsLoading: section === 'holdings' ? false : s.holdingsLoading,
    summaryLoading: section === 'summary' ? false : s.summaryLoading,
    recordsLoading: section === 'records' ? false : s.recordsLoading,
    saving: section === 'save' ? Math.max(0, s.saving - 1) : s.saving,
  })),
);
