import {
  CrmSubjectType,
  CrmTaskStatus,
  CrmTransactionStage,
  LeadStage,
} from '../../core/models/crm';
import { crmLabel } from '../../core/models/crm';
import { labelFor } from '../../shared/pipes/label.pipe';

export type CrmTab = 'overview' | 'clients' | 'leads' | 'tasks' | 'deals';
export type CrmKind = Exclude<CrmTab, 'overview'>;

export const TABS: [CrmTab, string][] = [
  ['overview', 'Overview'],
  ['clients', 'Clients'],
  ['leads', 'Leads'],
  ['tasks', 'Tasks'],
  ['deals', 'Deals'],
];
/** One record's noun, for buttons and counts. */
export const NOUN: Record<CrmKind, [string, string]> = {
  clients: ['client', 'clients'],
  leads: ['lead', 'leads'],
  tasks: ['task', 'tasks'],
  deals: ['deal', 'deals'],
};
/** The tab that lists an activity's subject. */
export const TAB_OF: Record<CrmSubjectType, CrmKind> = {
  CLIENT: 'clients',
  LEAD: 'leads',
  TASK: 'tasks',
  TRANSACTION: 'deals',
};

/** The button for moving a lead on: "Move to Contacted", or "Mark lost". */
export function leadAction(next: LeadStage): string {
  return next === 'LOST' ? 'Mark lost' : 'Move to ' + crmLabel(next);
}
export function dealAction(next: CrmTransactionStage): string {
  return next === 'CANCELLED' ? 'Cancel deal' : 'Move to ' + crmLabel(next);
}
/** The button for a task's next status, in the words of what it does. */
export function taskAction(current: CrmTaskStatus, next: CrmTaskStatus): string {
  if (next === 'OPEN') return current === 'IN_PROGRESS' ? 'Pause' : 'Reopen';
  if (next === 'IN_PROGRESS') return 'Start';
  if (next === 'COMPLETED') return 'Mark done';
  return 'Cancel task';
}
/** A lead's source: typed words as typed; a code from the system ("WEBSITE") in words. */
export function sourceWord(source: string): string {
  const s = source.trim();
  // Short capitals are acronyms someone typed ("MLS"); longer ones and snake case are codes.
  return /^[A-Z][A-Z0-9_]*$/.test(s) && (s.includes('_') || s.length > 4) ? labelFor(s) : source;
}
/** The way forward is the primary action; giving up (lost, cancelled) is secondary. */
export function isForward(next: string): boolean {
  return !['LOST', 'CANCELLED', 'OPEN'].includes(next);
}
