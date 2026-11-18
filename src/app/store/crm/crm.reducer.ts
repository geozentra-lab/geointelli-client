import { EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Page } from '../../core/models/api';
import {
  CrmActivityDTO,
  CrmClientDTO,
  CrmLeadDTO,
  CrmPipelineDTO,
  CrmTaskDTO,
  CrmTaskSummaryDTO,
  CrmTransactionDTO,
} from '../../core/models/crm';
import { CrmActions as A } from './crm.actions';
import { CrmCollection, CrmList } from './crm.model';
export const clientsAdapter = createEntityAdapter<CrmClientDTO>();
export const leadsAdapter = createEntityAdapter<CrmLeadDTO>();
export const tasksAdapter = createEntityAdapter<CrmTaskDTO>();
export const dealsAdapter = createEntityAdapter<CrmTransactionDTO>();
function list<T>(adapter: EntityAdapter<T>): CrmList<T> {
  return adapter.getInitialState({
    page: 0,
    totalElements: 0,
    totalPages: 0,
    loading: false,
    loaded: false,
    error: null,
    filter: null,
  });
}
const initial = {
  clients: list(clientsAdapter),
  leads: list(leadsAdapter),
  tasks: list(tasksAdapter),
  deals: list(dealsAdapter),
  summary: null as CrmTaskSummaryDTO | null,
  pipeline: null as CrmPipelineDTO | null,
  activities: null as Page<CrmActivityDTO> | null,
  overviewLoading: false,
  overviewError: null as string | null,
  /** Up to 100 newest records per type, for pickers and display names. */
  options: {
    clients: [] as CrmClientDTO[],
    leads: [] as CrmLeadDTO[],
    deals: [] as CrmTransactionDTO[],
    loaded: false,
  },
  /** The single history panel that is open, keyed `SUBJECT:id`. */
  history: {
    key: null as string | null,
    page: null as Page<CrmActivityDTO> | null,
    loading: false,
    error: null as string | null,
  },
  saving: 0,
  saveError: null as string | null,
};
export type CrmState = typeof initial;
type Lists = Pick<CrmState, CrmCollection>;
function loading<K extends CrmCollection>(
  s: CrmState,
  key: K,
  page: number,
  filter: string | null,
): CrmState {
  return { ...s, [key]: { ...s[key], page, filter, loading: true, error: null } };
}
function loaded<K extends CrmCollection>(
  s: CrmState,
  key: K,
  adapter: EntityAdapter<any>,
  page: Page<any>,
): CrmState {
  const current = s[key] as Lists[K];
  return {
    ...s,
    [key]: adapter.setAll(page.content, {
      ...current,
      page: page.page,
      totalElements: page.totalElements,
      totalPages: page.totalPages,
      loading: false,
      loaded: true,
    }),
  };
}
export const crmReducer = createReducer<CrmState>(
  initial,
  on(A.loadOverview, (s) => ({ ...s, overviewLoading: true, overviewError: null })),
  on(A.overviewLoaded, (s, { summary, pipeline, activities }) => ({
    ...s,
    summary,
    pipeline,
    activities,
    overviewLoading: false,
  })),
  on(A.overviewFailed, (s, { error }) => ({ ...s, overviewLoading: false, overviewError: error })),
  on(A.optionsLoaded, (s, options) => ({
    ...s,
    options: { clients: options.clients, leads: options.leads, deals: options.deals, loaded: true },
  })),
  on(A.loadClients, (s, { page }) => loading(s, 'clients', page, null)),
  on(A.loadLeads, (s, { page, stage }) => loading(s, 'leads', page, stage)),
  on(A.loadTasks, (s, { page, status }) => loading(s, 'tasks', page, status)),
  on(A.loadDeals, (s, { page, stage }) => loading(s, 'deals', page, stage)),
  on(A.clientsLoaded, (s, { page }) => loaded(s, 'clients', clientsAdapter, page)),
  on(A.leadsLoaded, (s, { page }) => loaded(s, 'leads', leadsAdapter, page)),
  on(A.tasksLoaded, (s, { page }) => loaded(s, 'tasks', tasksAdapter, page)),
  on(A.dealsLoaded, (s, { page }) => loaded(s, 'deals', dealsAdapter, page)),
  on(A.collectionFailed, (s, { collection, error }) => ({
    ...s,
    [collection]: { ...s[collection], loading: false, error },
  })),
  on(A.loadHistory, (s, { subject, id }) => {
    const key = subject + ':' + id;
    return {
      ...s,
      history: {
        key,
        page: s.history.key === key ? s.history.page : null,
        loading: true,
        error: null,
      },
    };
  }),
  on(A.historyLoaded, (s, { key, page }) =>
    s.history.key === key ? { ...s, history: { ...s.history, page, loading: false } } : s,
  ),
  on(A.historyFailed, (s, { key, error }) =>
    s.history.key === key ? { ...s, history: { ...s.history, loading: false, error } } : s,
  ),
  on(A.closeHistory, (s) => ({ ...s, history: initial.history })),
  on(
    A.createClient,
    A.updateClient,
    A.deleteClient,
    A.createLead,
    A.updateLead,
    A.createTask,
    A.updateTask,
    A.deleteTask,
    A.createDeal,
    A.updateDeal,
    A.addNote,
    (s) => ({ ...s, saving: s.saving + 1, saveError: null }),
  ),
  on(A.saved, (s) => ({ ...s, saving: Math.max(0, s.saving - 1) })),
  on(A.saveFailed, (s, { error }) => ({
    ...s,
    saving: Math.max(0, s.saving - 1),
    saveError: error,
  })),
);
