import { createReducer, on } from '@ngrx/store';
import {
  OpportunityPageDTO,
  OpportunityQuery,
  OpportunityRefreshResultDTO,
} from '../../core/models/opportunity';
import { Remote, done, failed, idle, pending } from '../remote';
import { OpportunitiesActions as A } from './opportunities.actions';
export const OPPORTUNITY_PAGE_SIZE = 12;
export interface OpportunitiesState {
  query: OpportunityQuery;
  results: Remote<OpportunityPageDTO>;
  top: Remote<OpportunityPageDTO>;
  refresh: Remote<OpportunityRefreshResultDTO>;
}
export const opportunitiesReducer = createReducer<OpportunitiesState>(
  {
    query: { page: 0, size: OPPORTUNITY_PAGE_SIZE, sort: 'SCORE_DESC' },
    results: idle(),
    top: idle(),
    refresh: idle(),
  },
  // The previous page stays visible while the next one loads.
  on(A.browse, (s, { query }) => ({ ...s, query, results: pending(s.results) })),
  on(A.browsed, (s, { query, page }) => (query === s.query ? { ...s, results: done(page) } : s)),
  on(A.browseFailed, (s, { error }) => ({ ...s, results: failed(s.results, error) })),
  on(A.loadTop, (s) => ({ ...s, top: pending(s.top) })),
  on(A.topLoaded, (s, { page }) => ({ ...s, top: done(page) })),
  on(A.topFailed, (s, { error }) => ({ ...s, top: failed(s.top, error) })),
  on(A.refreshScores, (s) => ({ ...s, refresh: pending(s.refresh, false) })),
  on(A.scoresRefreshed, (s, { result }) => ({ ...s, refresh: done(result) })),
  on(A.refreshFailed, (s, { error }) => ({ ...s, refresh: failed(s.refresh, error) })),
);
