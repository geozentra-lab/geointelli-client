import { UserActions } from '../user/user.actions';
import { EntityState, createEntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { AlertRuleDTO, AlertMonitoringDTO } from '../../core/models/api';
import { alertsActions as A } from './alerts.actions';
export const alertsAdapter = createEntityAdapter<AlertRuleDTO>();
const extra = {
  loading: false,
  saving: 0,
  error: null as string | null,
  errorOperation: null as 'load' | 'save' | null,
  page: 0,
  totalElements: 0,
  totalPages: 0,
  monitoring: {} as Record<number, AlertMonitoringDTO>,
  monitoringErrors: {} as Record<number, string>,
  monitoringPending: {} as Record<number, boolean>,
  evaluationPending: {} as Record<number, boolean>,
};
const initial = alertsAdapter.getInitialState<EntityState<AlertRuleDTO> & typeof extra>(extra);
export const alertsReducer = createReducer<typeof initial>(
  initial,
  on(UserActions.loaded, (s) => ({ ...s, loading: true, error: null })),
  on(A.load, (s: typeof initial, { page }) => ({ ...s, page, loading: true, error: null })),
  on(A.loaded, (s: typeof initial, { page }) =>
    alertsAdapter.setAll(page.content, {
      ...s,
      page: page.page,
      totalElements: page.totalElements,
      totalPages: page.totalPages,
      loading: false,
    }),
  ),
  on(A.create, A.update, A.remove, (s: typeof initial) => ({
    ...s,
    saving: s.saving + 1,
    error: null,
  })),
  on(A.saved, (s: typeof initial, { item }) =>
    alertsAdapter.upsertOne(item, {
      ...s,
      saving: Math.max(0, s.saving - 1),
      totalElements: s.totalElements + (s.entities[item.id] ? 0 : 1),
    }),
  ),
  on(A.removed, (s: typeof initial, { id }) =>
    alertsAdapter.removeOne(id, {
      ...s,
      saving: Math.max(0, s.saving - 1),
      totalElements: Math.max(0, s.totalElements - 1),
    }),
  ),
  on(A.failed, (s: typeof initial, { error, operation }) => ({
    ...s,
    error,
    errorOperation: operation,
    loading: operation === 'load' ? false : s.loading,
    saving: operation === 'save' ? Math.max(0, s.saving - 1) : s.saving,
  })),
  on(A.monitoring, (s, { id }) => ({
    ...s,
    monitoringPending: { ...s.monitoringPending, [id]: true },
    monitoringErrors: { ...s.monitoringErrors, [id]: '' },
  })),
  on(A.evaluate, (s, { id }) => ({
    ...s,
    evaluationPending: { ...s.evaluationPending, [id]: true },
    monitoringErrors: { ...s.monitoringErrors, [id]: '' },
  })),
  on(A.evaluationScheduled, (s, { id }) => ({
    ...s,
    evaluationPending: { ...s.evaluationPending, [id]: false },
  })),
  on(A.monitoringLoaded, (s: typeof initial, { id, status }) => ({
    ...s,
    monitoring: { ...s.monitoring, [id]: status },
    monitoringPending: { ...s.monitoringPending, [id]: false },
    monitoringErrors: { ...s.monitoringErrors, [id]: '' },
  })),
  on(A.monitoringFailed, (s: typeof initial, { id, error }) => ({
    ...s,
    monitoringPending: { ...s.monitoringPending, [id]: false },
    evaluationPending: { ...s.evaluationPending, [id]: false },
    monitoringErrors: { ...s.monitoringErrors, [id]: error },
  })),
);
