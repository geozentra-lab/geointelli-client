import { createReducer, on } from '@ngrx/store';
import { Page } from '../../core/models/api';
import { CrmActivityDTO } from '../../core/models/crm';
import {
  RealtorClientsLeadsCardDTO,
  RealtorTasksPipelineCardDTO,
} from '../../core/models/dashboard';
import { Remote, cardDone, done, failed, idle, pending } from '../remote';
import { RealtorDashboardActions as A } from './realtor-dashboard.actions';
export interface RealtorDashboardState {
  clientsLeads: Remote<RealtorClientsLeadsCardDTO>;
  tasksPipeline: Remote<RealtorTasksPipelineCardDTO>;
  /** The CRM activity feed; the dashboard has no card of its own for it. */
  activity: Remote<Page<CrmActivityDTO>>;
}
export const realtorDashboardReducer = createReducer<RealtorDashboardState>(
  { clientsLeads: idle(), tasksPipeline: idle(), activity: idle() },
  on(A.load, (s) => ({
    clientsLeads: pending(s.clientsLeads),
    tasksPipeline: pending(s.tasksPipeline),
    activity: pending(s.activity),
  })),
  on(A.clientsLeadsLoaded, (s, { card }) => ({ ...s, clientsLeads: cardDone(card) })),
  on(A.tasksPipelineLoaded, (s, { card }) => ({ ...s, tasksPipeline: cardDone(card) })),
  on(A.activityLoaded, (s, { page }) => ({ ...s, activity: done(page) })),
  on(A.cardFailed, (s, { card, error }) => ({ ...s, [card]: failed(s[card], error) })),
);
