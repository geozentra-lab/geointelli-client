import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Page } from '../../core/models/api';
import {
  CrmActivityDTO,
  CrmClientCreateRequest,
  CrmClientDTO,
  CrmClientUpdateRequest,
  CrmLeadCreateRequest,
  CrmLeadDTO,
  CrmLeadUpdateRequest,
  CrmPipelineDTO,
  CrmSubjectType,
  CrmTaskCreateRequest,
  CrmTaskDTO,
  CrmTaskStatus,
  CrmTaskSummaryDTO,
  CrmTaskUpdateRequest,
  CrmTransactionCreateRequest,
  CrmTransactionDTO,
  CrmTransactionStage,
  CrmTransactionUpdateRequest,
  LeadStage,
} from '../../core/models/crm';
import { CrmCollection } from './crm.model';
export const CrmActions = createActionGroup({
  source: 'CRM API',
  events: {
    'Load overview': emptyProps(),
    'Overview loaded': props<{
      summary: CrmTaskSummaryDTO;
      pipeline: CrmPipelineDTO;
      activities: Page<CrmActivityDTO>;
    }>(),
    'Overview failed': props<{ error: string }>(),
    'Load options': emptyProps(),
    /** `failed`: lists that could not be read (sent empty; the ones already held are kept). */
    'Options loaded': props<{
      clients: CrmClientDTO[];
      leads: CrmLeadDTO[];
      deals: CrmTransactionDTO[];
      failed?: ('clients' | 'leads' | 'deals')[];
    }>(),
    'Load clients': props<{ page: number }>(),
    'Clients loaded': props<{ page: Page<CrmClientDTO> }>(),
    'Load leads': props<{ page: number; stage: LeadStage | null }>(),
    'Leads loaded': props<{ page: Page<CrmLeadDTO> }>(),
    'Load tasks': props<{ page: number; status: CrmTaskStatus | null }>(),
    'Tasks loaded': props<{ page: Page<CrmTaskDTO> }>(),
    'Load deals': props<{ page: number; stage: CrmTransactionStage | null }>(),
    'Deals loaded': props<{ page: Page<CrmTransactionDTO> }>(),
    'Collection failed': props<{ collection: CrmCollection; error: string }>(),
    'Load history': props<{ subject: CrmSubjectType; id: number; page: number }>(),
    'History loaded': props<{ key: string; page: Page<CrmActivityDTO> }>(),
    'History failed': props<{ key: string; error: string }>(),
    'Close history': emptyProps(),
    'Create client': props<{ request: CrmClientCreateRequest }>(),
    'Update client': props<{ id: number; request: CrmClientUpdateRequest }>(),
    'Delete client': props<{ id: number }>(),
    'Create lead': props<{ request: CrmLeadCreateRequest; idempotencyKey: string }>(),
    'Update lead': props<{ id: number; request: CrmLeadUpdateRequest }>(),
    'Create task': props<{ request: CrmTaskCreateRequest }>(),
    'Update task': props<{ id: number; request: CrmTaskUpdateRequest }>(),
    'Delete task': props<{ id: number }>(),
    'Create deal': props<{ request: CrmTransactionCreateRequest }>(),
    'Update deal': props<{ id: number; request: CrmTransactionUpdateRequest }>(),
    'Add note': props<{ subject: 'CLIENT' | 'LEAD'; id: number; description: string }>(),
    Saved: props<{ collection: CrmCollection | 'note'; message: string }>(),
    'Save failed': props<{ error: string }>(),
  },
});
