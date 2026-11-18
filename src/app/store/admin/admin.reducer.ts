import { createReducer, on } from '@ngrx/store';
import { Page } from '../../core/models/api';
import {
  DataQualityReportDTO,
  DataQualityRule,
  ValuationRefreshRequestDTO,
  ValuationRefreshStatus,
} from '../../core/models/admin';
import { Remote, done, failed, idle, pending } from '../remote';
import { AdminActions as A } from './admin.actions';
export interface AdminState {
  qualityRule: DataQualityRule | null;
  qualityPage: number;
  quality: Remote<DataQualityReportDTO>;
  refreshStatus: ValuationRefreshStatus | null;
  refreshPage: number;
  refreshes: Remote<Page<ValuationRefreshRequestDTO>>;
  /** Requests with a cancel or retry in flight. */
  acting: Record<string, 'cancel' | 'retry'>;
  actionError: string | null;
}
export const adminReducer = createReducer<AdminState>(
  {
    qualityRule: null,
    qualityPage: 0,
    quality: idle(),
    refreshStatus: null,
    refreshPage: 0,
    refreshes: idle(),
    acting: {},
    actionError: null,
  },
  on(A.loadDataQuality, (s, { rule, page }) => ({
    ...s,
    qualityRule: rule,
    qualityPage: page,
    quality: pending(s.quality),
  })),
  on(A.dataQualityLoaded, (s, { report }) => ({ ...s, quality: done(report) })),
  on(A.dataQualityFailed, (s, { error }) => ({ ...s, quality: failed(s.quality, error) })),
  on(A.loadRefreshRequests, (s, { status, page }) => ({
    ...s,
    refreshStatus: status,
    refreshPage: page,
    refreshes: pending(s.refreshes),
  })),
  on(A.refreshRequestsLoaded, (s, { page }) => ({ ...s, refreshes: done(page) })),
  on(A.refreshRequestsFailed, (s, { error }) => ({ ...s, refreshes: failed(s.refreshes, error) })),
  on(A.cancelRefresh, (s, { id }) => ({
    ...s,
    acting: { ...s.acting, [id]: 'cancel' as const },
    actionError: null,
  })),
  on(A.retryRefresh, (s, { id }) => ({
    ...s,
    acting: { ...s.acting, [id]: 'retry' as const },
    actionError: null,
  })),
  on(A.refreshRequestChanged, (s, { id, request }) => {
    const { [id]: _, ...acting } = s.acting;
    const page = s.refreshes.value;
    return {
      ...s,
      acting,
      // A cancel answers with the same request; a retry answers with a new one, listed first.
      refreshes: page
        ? done({
            ...page,
            content:
              request.requestId === id
                ? page.content.map((r) => (r.requestId === id ? request : r))
                : [request, ...page.content],
          })
        : s.refreshes,
    };
  }),
  on(A.refreshActionFailed, (s, { id, error }) => {
    const { [id]: _, ...acting } = s.acting;
    return { ...s, acting, actionError: error };
  }),
);
