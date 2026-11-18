import { StageBars, StageRow } from '../dashboard/dash-ui';
import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { Metric } from '../../shared/components/metric';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { CrmHistory } from './crm-history';
import { PropertyPicker } from '../../shared/components/property-picker';
import { PropertyRef } from '../../shared/components/property-ref';
import { CrmActions as A } from '../../store/crm/crm.actions';
import {
  selectCrm,
  selectCrmClientNames,
  selectCrmClients,
  selectCrmDeals,
  selectCrmLeads,
  selectCrmTasks,
} from '../../store/crm/crm.selectors';
import {
  CrmClientDTO,
  CrmClientUpdateRequest,
  CrmSubjectType,
  CrmTaskDTO,
  CrmTaskStatus,
  CrmTransactionStage,
  DEAL_STAGES,
  LEAD_STAGES,
  LeadStage,
  TASK_STATUSES,
  crmLabel,
  nextDealStages,
  nextLeadStages,
  nextTaskStatuses,
} from '../../core/models/crm';
type Tab = 'overview' | 'clients' | 'leads' | 'tasks' | 'deals';
type Draft = 'client' | 'edit' | 'lead' | 'task' | 'deal';
const emptyClient = () => ({ name: '', email: '', phone: '', notes: '' });
const emptyLead = () => ({
  clientId: null as number | null,
  propertyId: null as number | null,
  title: '',
  source: '',
  notes: '',
});
const emptyTask = () => ({
  title: '',
  description: '',
  dueAt: '',
  clientId: null as number | null,
  leadId: null as number | null,
  propertyId: null as number | null,
  transactionId: null as number | null,
});
const emptyDeal = () => ({
  title: '',
  description: '',
  clientId: null as number | null,
  leadId: null as number | null,
  propertyId: null as number | null,
  expectedCloseDate: '',
});
const text = (value: string) => value.trim() || undefined;
const id = (value: number | null) => (value && value > 0 ? value : undefined);
@Component({
  imports: [
    DatePipe,
    FormsModule,
    PageHeading,
    RequestStatus,
    Pagination,
    Metric,
    CrmHistory,
    PropertyPicker,
    PropertyRef,
    StageBars,
  ],
  templateUrl: './crm.html',
  styles: `
    .crm-row {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      padding: 16px 0;
      border-bottom: 1px solid var(--line);
    }
    .crm-row:last-of-type {
      border-bottom: 0;
    }
    .crm-main {
      flex: 1;
      min-width: 0;
    }
    .crm-main p {
      margin: 4px 0;
      color: var(--ink-2);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .crm-row > .actions {
      align-items: flex-start;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .crm-filter {
      margin-bottom: 8px;
    }
    @media (max-width: 720px) {
      .crm-row {
        flex-direction: column;
      }
      .crm-row > .actions {
        justify-content: flex-start;
      }
    }
  `,
})
export class Crm implements OnInit {
  w = inject(Workspace);
  private confirmation = inject(ConfirmationService);
  private destroy = inject(DestroyRef);
  crm = this.w.store.selectSignal(selectCrm);
  clients = this.w.store.selectSignal(selectCrmClients);
  leads = this.w.store.selectSignal(selectCrmLeads);
  tasks = this.w.store.selectSignal(selectCrmTasks);
  deals = this.w.store.selectSignal(selectCrmDeals);
  clientNames = this.w.store.selectSignal(selectCrmClientNames);
  readonly tabs: [Tab, string][] = [
    ['overview', 'Overview'],
    ['clients', 'Clients'],
    ['leads', 'Leads'],
    ['tasks', 'Tasks'],
    ['deals', 'Deals'],
  ];
  readonly leadStages = LEAD_STAGES;
  readonly taskStatuses = TASK_STATUSES;
  readonly dealStages = DEAL_STAGES;
  readonly sources = ['Website', 'Referral', 'Phone call', 'Email', 'Open house', 'Social media'];
  label = crmLabel;
  nextLeadStages = nextLeadStages;
  nextTaskStatuses = nextTaskStatuses;
  nextDealStages = nextDealStages;
  tab = signal<Tab>('overview');
  /** `SUBJECT:id` of the record whose history panel is expanded. */
  expanded = signal<string | null>(null);
  editingClient = signal<number | null>(null);
  client = emptyClient();
  edit = emptyClient();
  lead = emptyLead();
  task = emptyTask();
  deal = emptyDeal();
  /** Retried submissions of the same draft reuse this key, so the server never duplicates the lead. */
  private leadKey = crypto.randomUUID();
  private pending: Draft | null = null;
  private route = inject(ActivatedRoute);
  constructor() {
    effect(() => {
      const s = this.crm();
      if (this.pending === null || s.saving) return;
      if (!s.saveError) {
        if (this.pending === 'client') this.client = emptyClient();
        if (this.pending === 'edit') this.editingClient.set(null);
        if (this.pending === 'lead') {
          this.lead = emptyLead();
          this.leadKey = crypto.randomUUID();
        }
        if (this.pending === 'task') this.task = emptyTask();
        if (this.pending === 'deal') this.deal = emptyDeal();
      }
      this.pending = null;
    });
  }
  ngOnInit() {
    if (!this.w.auth.isLoggedIn()) return;
    this.w.store.dispatch(A.loadOptions());
    // Deep links such as /crm/leads (used by contact-request notifications) open that tab.
    const tab = this.route.snapshot.paramMap.get('tab') as Tab | null;
    if (tab && this.tabs.some((t) => t[0] === tab)) {
      // A cached list would hide the lead a notification just pointed at; refresh it.
      const stale = tab === 'leads' && this.crm().leads.loaded;
      this.select(tab);
      // ?stage= (from the dashboard pipeline) opens the list filtered on that stage.
      const stage = this.route.snapshot.queryParamMap.get('stage');
      if (tab === 'leads' && stage && this.leadStages.includes(stage as LeadStage))
        this.loadLeads(0, stage as LeadStage);
      else if (tab === 'deals' && stage && this.dealStages.includes(stage as CrmTransactionStage))
        this.loadDeals(0, stage as CrmTransactionStage);
      else if (stale) this.loadLeads(0);
    } else this.w.store.dispatch(A.loadOverview());
  }
  select(tab: Tab) {
    this.tab.set(tab);
    this.expanded.set(null);
    this.w.store.dispatch(A.closeHistory());
    if (!this.w.auth.isLoggedIn()) return;
    const s = this.crm();
    if (tab === 'overview') this.w.store.dispatch(A.loadOverview());
    if (tab === 'clients' && !s.clients.loaded) this.loadClients(0);
    if (tab === 'leads' && !s.leads.loaded) this.loadLeads(0);
    if (tab === 'tasks' && !s.tasks.loaded) this.loadTasks(0);
    if (tab === 'deals' && !s.deals.loaded) this.loadDeals(0);
  }
  onTabKey(event: KeyboardEvent) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const button = event.currentTarget as HTMLButtonElement;
    const buttons = Array.from(
      button.parentElement!.querySelectorAll<HTMLButtonElement>('[role=tab]'),
    );
    const index = buttons.indexOf(button);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    this.select(buttons[next].dataset['tab'] as Tab);
    buttons[next].focus();
  }
  loadClients(page: number) {
    this.w.store.dispatch(A.loadClients({ page }));
  }
  loadLeads(page: number, stage = this.crm().leads.filter as LeadStage | null) {
    this.w.store.dispatch(A.loadLeads({ page, stage }));
  }
  loadTasks(page: number, status = this.crm().tasks.filter as CrmTaskStatus | null) {
    this.w.store.dispatch(A.loadTasks({ page, status }));
  }
  loadDeals(page: number, stage = this.crm().deals.filter as CrmTransactionStage | null) {
    this.w.store.dispatch(A.loadDeals({ page, stage }));
  }
  toggleHistory(subject: CrmSubjectType, recordId: number) {
    const key = subject + ':' + recordId;
    if (this.expanded() === key) {
      this.expanded.set(null);
      this.w.store.dispatch(A.closeHistory());
    } else this.expanded.set(key);
  }
  /** Activity items link to the tab that lists their subject. */
  openSubject(subject: CrmSubjectType) {
    this.select(
      (
        { CLIENT: 'clients', LEAD: 'leads', TASK: 'tasks', TRANSACTION: 'deals' } as Record<
          CrmSubjectType,
          Tab
        >
      )[subject],
    );
  }
  clientName(clientId: number | null) {
    return clientId === null ? '' : (this.clientNames()[clientId] ?? 'Client ' + clientId);
  }
  private ready(action: string) {
    return !this.crm().saving && this.w.requireAccount(action);
  }
  private hasContact(c: { email: string; phone: string }) {
    if (c.email.trim() || c.phone.trim()) return true;
    this.w.toast('Add an email address or a phone number for this client.');
    return false;
  }

  createClient() {
    if (!this.ready('add clients') || !this.client.name.trim() || !this.hasContact(this.client))
      return;
    this.pending = 'client';
    const c = this.client;
    this.w.store.dispatch(
      A.createClient({
        request: {
          name: c.name.trim(),
          email: text(c.email),
          phone: text(c.phone),
          notes: text(c.notes),
        },
      }),
    );
  }
  startEdit(c: CrmClientDTO) {
    this.editingClient.set(c.id);
    this.edit = {
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      notes: c.notes ?? '',
    };
  }
  saveClient(c: CrmClientDTO) {
    if (!this.ready('update clients') || !this.edit.name.trim() || !this.hasContact(this.edit))
      return;
    // PATCH only what changed; an emptied optional field is cleared with null.
    const request: CrmClientUpdateRequest = {};
    const name = this.edit.name.trim();
    if (name !== c.name) request.name = name;
    for (const key of ['email', 'phone', 'notes'] as const) {
      const value = this.edit[key].trim() || null;
      if (value !== (c[key] ?? null)) request[key] = value;
    }
    if (!Object.keys(request).length) {
      this.editingClient.set(null);
      return;
    }
    this.pending = 'edit';
    this.w.store.dispatch(A.updateClient({ id: c.id, request }));
  }
  async deleteClient(c: CrmClientDTO) {
    if (
      (await this.confirmation.confirm({
        title: 'Delete client?',
        message:
          'Delete "' +
          c.name +
          '"? Clients linked to a lead, task or deal cannot be deleted. Their activity history is kept.',
      })) &&
      !this.destroy.destroyed &&
      this.ready('delete clients')
    ) {
      if (this.expanded() === 'CLIENT:' + c.id) this.toggleHistory('CLIENT', c.id);
      this.w.store.dispatch(A.deleteClient({ id: c.id }));
    }
  }

  createLead() {
    const l = this.lead;
    if (!this.ready('capture leads') || !l.clientId || !l.title.trim() || !l.source.trim()) return;
    this.pending = 'lead';
    this.w.store.dispatch(
      A.createLead({
        request: {
          clientId: l.clientId,
          propertyId: id(l.propertyId),
          title: l.title.trim(),
          source: l.source.trim(),
          notes: text(l.notes),
        },
        idempotencyKey: this.leadKey,
      }),
    );
  }
  async moveLead(leadId: number, stage: LeadStage) {
    if (
      (stage === 'CONVERTED' || stage === 'LOST') &&
      !(await this.confirmation.confirm({
        title: stage === 'CONVERTED' ? 'Mark lead as converted?' : 'Mark lead as lost?',
        message:
          'This is a final stage and cannot be changed later. Notes and details stay editable.',
        confirmLabel: stage === 'CONVERTED' ? 'Mark converted' : 'Mark lost',
      }))
    )
      return;
    if (!this.destroy.destroyed && this.ready('update leads'))
      this.w.store.dispatch(A.updateLead({ id: leadId, request: { stage } }));
  }

  createTask() {
    const t = this.task;
    if (!this.ready('create tasks') || !t.title.trim()) return;
    const due = t.dueAt ? new Date(t.dueAt) : null;
    if (due && Number.isNaN(due.getTime())) {
      this.w.toast('Enter a valid due date.');
      return;
    }
    this.pending = 'task';
    this.w.store.dispatch(
      A.createTask({
        request: {
          title: t.title.trim(),
          description: text(t.description),
          dueAt: due?.toISOString(),
          clientId: id(t.clientId),
          leadId: id(t.leadId),
          propertyId: id(t.propertyId),
          transactionId: id(t.transactionId),
        },
      }),
    );
  }
  moveTask(taskId: number, status: CrmTaskStatus) {
    if (this.ready('update tasks'))
      this.w.store.dispatch(A.updateTask({ id: taskId, request: { status } }));
  }
  async deleteTask(t: CrmTaskDTO) {
    if (
      (await this.confirmation.confirm({
        title: 'Delete task?',
        message: 'Delete "' + t.title + '"? Linked clients, leads and deals are not changed.',
      })) &&
      !this.destroy.destroyed &&
      this.ready('delete tasks')
    ) {
      if (this.expanded() === 'TASK:' + t.id) this.toggleHistory('TASK', t.id);
      this.w.store.dispatch(A.deleteTask({ id: t.id }));
    }
  }

  dealLeads() {
    return this.crm().options.leads.filter((l) => l.clientId === this.deal.clientId);
  }
  createDeal() {
    const d = this.deal;
    if (!this.ready('create deals') || !d.title.trim() || !d.clientId || !id(d.propertyId)) return;
    this.pending = 'deal';
    this.w.store.dispatch(
      A.createDeal({
        request: {
          title: d.title.trim(),
          description: text(d.description),
          clientId: d.clientId,
          leadId: id(d.leadId),
          propertyId: d.propertyId!,
          expectedCloseDate: d.expectedCloseDate || undefined,
        },
      }),
    );
  }
  async moveDeal(dealId: number, stage: CrmTransactionStage) {
    if (
      (stage === 'CLOSED' || stage === 'CANCELLED') &&
      !(await this.confirmation.confirm({
        title: stage === 'CLOSED' ? 'Close this deal?' : 'Cancel this deal?',
        message:
          'Closed and cancelled deals cannot be reopened. This only updates your pipeline; no property or payment is transferred.',
        confirmLabel: stage === 'CLOSED' ? 'Close deal' : 'Cancel deal',
      }))
    )
      return;
    if (!this.destroy.destroyed && this.ready('update deals'))
      this.w.store.dispatch(A.updateDeal({ id: dealId, request: { stage } }));
  }
  /** The same pipeline bars as the realtor dashboard; each opens the deals list on that stage. */
  pipelineRows = computed<StageRow[]>(() => {
    const p = this.crm().pipeline;
    return this.dealStages.map((stage) => ({
      key: stage,
      label: crmLabel(stage),
      count: p?.stages[stage] ?? 0,
      muted: stage === 'CANCELLED',
    }));
  });
}
