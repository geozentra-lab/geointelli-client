import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Page } from '../../core/models/api';
import { CrmActivityDTO } from '../../core/models/crm';
import {
  RealtorClientsLeadsCardDTO,
  RealtorTasksPipelineCardDTO,
} from '../../core/models/dashboard';
export type RealtorCardKey = 'clientsLeads' | 'tasksPipeline' | 'activity';
export const RealtorDashboardActions = createActionGroup({
  source: 'Realtor dashboard API',
  events: {
    Load: emptyProps(),
    'Clients leads loaded': props<{ card: RealtorClientsLeadsCardDTO }>(),
    'Tasks pipeline loaded': props<{ card: RealtorTasksPipelineCardDTO }>(),
    'Activity loaded': props<{ page: Page<CrmActivityDTO> }>(),
    'Card failed': props<{ card: RealtorCardKey; error: string }>(),
  },
});
