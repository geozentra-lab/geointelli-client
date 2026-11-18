import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CrmState, clientsAdapter, dealsAdapter, leadsAdapter, tasksAdapter } from './crm.reducer';
export const selectCrm = createFeatureSelector<CrmState>('crm');
export const selectCrmClients = createSelector(selectCrm, (s) =>
  clientsAdapter.getSelectors().selectAll(s.clients),
);
export const selectCrmLeads = createSelector(selectCrm, (s) =>
  leadsAdapter.getSelectors().selectAll(s.leads),
);
export const selectCrmTasks = createSelector(selectCrm, (s) =>
  tasksAdapter.getSelectors().selectAll(s.tasks),
);
export const selectCrmDeals = createSelector(selectCrm, (s) =>
  dealsAdapter.getSelectors().selectAll(s.deals),
);
/** Client names by id, from the current page and the picker options. */
export const selectCrmClientNames = createSelector(selectCrm, (s) => {
  const names: Record<number, string> = {};
  for (const c of [...s.options.clients, ...Object.values(s.clients.entities)])
    if (c) names[c.id] = c.name;
  return names;
});
