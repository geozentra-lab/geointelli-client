/** CRM contracts of property-service master (clients, leads, tasks, deals, activity). Current-user scope only. */
export type LeadStage = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
export type CrmTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type CrmTransactionStage =
  | 'PROSPECT'
  | 'VIEWING'
  | 'OFFER'
  | 'UNDER_CONTRACT'
  | 'CLOSED'
  | 'CANCELLED';
export type CrmSubjectType = 'CLIENT' | 'LEAD' | 'TASK' | 'TRANSACTION';
export type CrmActivityType =
  | 'CLIENT_CREATED'
  | 'CLIENT_UPDATED'
  | 'CLIENT_DELETED'
  | 'LEAD_CREATED'
  | 'LEAD_UPDATED'
  | 'LEAD_STAGE_CHANGED'
  | 'NOTE_ADDED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_DELETED'
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_UPDATED'
  | 'TRANSACTION_STAGE_CHANGED';

export interface CrmClientDTO {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CrmClientCreateRequest {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}
/** PATCH: omitted fields stay unchanged; null clears email, phone or notes. */
export interface CrmClientUpdateRequest {
  name?: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface CrmLeadDTO {
  id: number;
  clientId: number;
  propertyId: number | null;
  title: string;
  source: string;
  stage: LeadStage;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CrmLeadCreateRequest {
  clientId: number;
  propertyId?: number;
  title: string;
  source: string;
  notes?: string;
}
export interface CrmLeadUpdateRequest {
  title?: string;
  source?: string;
  notes?: string | null;
  propertyId?: number | null;
  stage?: LeadStage;
}

export interface CrmTaskDTO {
  id: number;
  title: string;
  description: string | null;
  status: CrmTaskStatus;
  dueAt: string | null;
  completedAt: string | null;
  overdue: boolean;
  clientId: number | null;
  leadId: number | null;
  propertyId: number | null;
  transactionId: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface CrmTaskCreateRequest {
  title: string;
  description?: string;
  /** ISO-8601 instant with Z or an offset. */
  dueAt?: string;
  clientId?: number;
  leadId?: number;
  propertyId?: number;
  transactionId?: number;
}
export interface CrmTaskUpdateRequest {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  status?: CrmTaskStatus;
}
export interface CrmTaskSummaryDTO {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  asOf: string;
}

export interface CrmTransactionDTO {
  id: number;
  title: string;
  description: string | null;
  stage: CrmTransactionStage;
  clientId: number;
  leadId: number | null;
  propertyId: number;
  /** YYYY-MM-DD */
  expectedCloseDate: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CrmTransactionCreateRequest {
  title: string;
  description?: string;
  clientId: number;
  leadId?: number;
  propertyId: number;
  expectedCloseDate?: string;
}
export interface CrmTransactionUpdateRequest {
  title?: string;
  description?: string | null;
  expectedCloseDate?: string | null;
  stage?: CrmTransactionStage;
}
export interface CrmPipelineDTO {
  total: number;
  stages: Record<CrmTransactionStage, number>;
  asOf: string;
}

export interface CrmActivityDTO {
  id: number;
  clientId: number | null;
  subjectType: CrmSubjectType;
  subjectId: number;
  activityType: CrmActivityType;
  description: string | null;
  createdAt: string;
}

export const LEAD_STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
export const TASK_STATUSES: CrmTaskStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const DEAL_STAGES: CrmTransactionStage[] = [
  'PROSPECT',
  'VIEWING',
  'OFFER',
  'UNDER_CONTRACT',
  'CLOSED',
  'CANCELLED',
];

/** Mirrors LeadStage.canChangeTo: forward one step, or LOST from any open stage. */
export function nextLeadStages(stage: LeadStage): LeadStage[] {
  return (
    {
      NEW: ['CONTACTED', 'LOST'],
      CONTACTED: ['QUALIFIED', 'LOST'],
      QUALIFIED: ['CONVERTED', 'LOST'],
      CONVERTED: [],
      LOST: [],
    } as Record<LeadStage, LeadStage[]>
  )[stage];
}
/** Mirrors CrmTaskStatus.canChangeTo: active tasks move freely; closed tasks only reopen. */
export function nextTaskStatuses(status: CrmTaskStatus): CrmTaskStatus[] {
  return (
    {
      OPEN: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      IN_PROGRESS: ['OPEN', 'COMPLETED', 'CANCELLED'],
      COMPLETED: ['OPEN'],
      CANCELLED: ['OPEN'],
    } as Record<CrmTaskStatus, CrmTaskStatus[]>
  )[status];
}
/** Mirrors CrmTransactionStage.canChangeTo: forward one step, or CANCELLED from any open stage. */
export function nextDealStages(stage: CrmTransactionStage): CrmTransactionStage[] {
  return (
    {
      PROSPECT: ['VIEWING', 'CANCELLED'],
      VIEWING: ['OFFER', 'CANCELLED'],
      OFFER: ['UNDER_CONTRACT', 'CANCELLED'],
      UNDER_CONTRACT: ['CLOSED', 'CANCELLED'],
      CLOSED: [],
      CANCELLED: [],
    } as Record<CrmTransactionStage, CrmTransactionStage[]>
  )[stage];
}

const labels: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  CONVERTED: 'Converted',
  LOST: 'Lost',
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  PROSPECT: 'Prospect',
  VIEWING: 'Viewing',
  OFFER: 'Offer',
  UNDER_CONTRACT: 'Under contract',
  CLOSED: 'Closed',
  CLIENT_CREATED: 'Client added',
  CLIENT_UPDATED: 'Client updated',
  CLIENT_DELETED: 'Client deleted',
  LEAD_CREATED: 'Lead captured',
  LEAD_UPDATED: 'Lead updated',
  LEAD_STAGE_CHANGED: 'Lead stage changed',
  NOTE_ADDED: 'Note added',
  TASK_CREATED: 'Task created',
  TASK_UPDATED: 'Task updated',
  TASK_STATUS_CHANGED: 'Task status changed',
  TASK_DELETED: 'Task deleted',
  TRANSACTION_CREATED: 'Deal created',
  TRANSACTION_UPDATED: 'Deal updated',
  TRANSACTION_STAGE_CHANGED: 'Deal stage changed',
};
export function crmLabel(value: string | null | undefined): string {
  return value ? (labels[value] ?? value) : '';
}
