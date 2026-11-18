import { EntityState } from '@ngrx/entity';
export type CrmCollection = 'clients' | 'leads' | 'tasks' | 'deals';
/** One server-paginated CRM list; filter is the backend stage/status query, null for all. */
export interface CrmList<T> extends EntityState<T> {
  page: number;
  totalElements: number;
  totalPages: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  filter: string | null;
}
export type {
  CrmClientDTO as CrmClient,
  CrmLeadDTO as CrmLead,
  CrmTaskDTO as CrmTask,
  CrmTransactionDTO as CrmDeal,
  CrmActivityDTO as CrmActivity,
} from '../../core/models/crm';
