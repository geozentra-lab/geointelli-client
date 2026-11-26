import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { PropertyRef } from '../../shared/components/property-ref';
import { Desk } from '../../shared/layout/desk';
import { RecordPane } from '../../shared/layout/record-pane';
import { StageLink, TABLE_KIT } from '../../shared/table';
import { countOf, formatLocalDate, formatRecordDate } from '../../shared/data/format';
import { Kpi, StageBars, StageRow } from '../dashboard/dash-ui';
import {
  CrmActivityDTO,
  CrmClientDTO,
  CrmLeadDTO,
  CrmTaskDTO,
  CrmTaskStatus,
  CrmTransactionDTO,
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
import { CrmActions as A } from '../../store/crm/crm.actions';
import {
  selectCrm,
  selectCrmClientNames,
  selectCrmClients,
  selectCrmDeals,
  selectCrmLeads,
  selectCrmTasks,
} from '../../store/crm/crm.selectors';
import { CrmClientRecord, CrmDealRecord, CrmLeadRecord, CrmTaskRecord, when } from './crm-record';
import { CrmForm } from './crm-form';
import {
  CrmKind,
  CrmTab,
  NOUN,
  TABS,
  TAB_OF,
  dealAction,
  isForward,
  leadAction,
  sourceWord,
  taskAction,
} from './crm-words';

type AnyRecord = CrmClientDTO | CrmLeadDTO | CrmTaskDTO | CrmTransactionDTO;

/**
 * The CRM (DESIGN.md §5 Register): an overview, then clients, leads, tasks and deals as tables at
 * /crm/:tab (the realtor's rail links), with stage or status links where the list has them
 * (?stage=, ?status=, with counts when the CRM's summaries give them). A row opens the record in
 * the Desk's pane with its stage actions, details and history; New … opens its form in the pane.
 */
@Component({
  imports: [
    RouterLink,
    PageHeading,
    RequestStatus,
    PropertyRef,
    Desk,
    RecordPane,
    Kpi,
    StageBars,
    CrmClientRecord,
    CrmLeadRecord,
    CrmTaskRecord,
    CrmDealRecord,
    CrmForm,
    ...TABLE_KIT,
  ],
  template: `<gz-desk [open]="pane() !== null" [label]="paneLabel()" (closed)="closePane()">
      <gz-heading [title]="title()" [subtitle]="subtitle()">
        @if (w.auth.isLoggedIn() && kind(); as k) {
          <button type="button" class="btn primary" #newButton (click)="openNew()">New {{ noun[k][0] }}</button>
        }
      </gz-heading>
      @if (!w.auth.isLoggedIn()) {
        <section class="cm-guest" aria-labelledby="cm-guest-title">
          <h2 id="cm-guest-title">Sign in to keep your client work</h2>
          <p class="cm-text">Clients, leads, tasks and deals stay private to your account.</p>
          <button type="button" class="btn primary" (click)="w.signIn()">Sign in</button>
        </section>
      } @else {
        <nav class="tabs" aria-label="CRM">
          @for (t of tabs; track t[0]) {
            <a [routerLink]="t[0] === 'overview' ? ['/crm'] : ['/crm', t[0]]" [class.active]="tab() === t[0]"
              [attr.aria-current]="tab() === t[0] ? 'page' : null">{{ t[1] }}</a>
          }
        </nav>
        @if (pane() === null && writeError(); as error) {
          <p class="field-error" role="alert">{{ error }}</p>
        }

        @if (tab() === 'overview') {
          <gz-request-status
            [loading]="crm().overviewLoading && !crm().summary"
            loadingText="Loading your CRM…"
            [error]="crm().overviewError"
            (retry)="loadOverview()"
          />
          @if (crm().summary; as s) {
            <section class="cm-section" aria-labelledby="cm-tasks-title">
              <h2 id="cm-tasks-title">Tasks</h2>
              <dl class="kpi-row">
                <div gz-kpi label="Open" [value]="s.open" link="/crm/tasks" [query]="{ status: 'OPEN' }"></div>
                <div gz-kpi label="In progress" [value]="s.inProgress" link="/crm/tasks" [query]="{ status: 'IN_PROGRESS' }"></div>
                <div gz-kpi label="Overdue" [value]="s.overdue" [caption]="s.overdue ? 'Past their due date' : 'Nothing overdue'"></div>
                <div gz-kpi label="Done" [value]="s.completed" link="/crm/tasks" [query]="{ status: 'COMPLETED' }"></div>
              </dl>
            </section>
          }
          <div class="cm-cols">
            @if (crm().pipeline; as p) {
              <section class="cm-section" aria-labelledby="cm-deals-title">
                <h2 id="cm-deals-title">Deals by stage</h2>
                <p class="cm-caption">{{ countOf(p.total, 'deal') }} · as of {{ day(p.asOf) }}</p>
                @if (p.total) {
                  <gz-stage-bars [rows]="pipelineRows()" link="/crm/deals" param="stage" label="Deals by stage" />
                } @else {
                  <p class="cm-text">Deals you create appear here by stage.</p>
                }
              </section>
            }
            @if (crm().activities; as feed) {
              <section class="cm-section" aria-labelledby="cm-activity-title">
                <h2 id="cm-activity-title">Recent activity</h2>
                @if (feed.content.length) {
                  <table gz-table sticky="none" (activated)="view($event)">
                    <caption class="sr-only">Recent activity. Choose a row to open its record.</caption>
                    <thead>
                      <tr>
                        <th scope="col">What happened</th>
                        <th scope="col" data-priority="2">Record</th>
                        <th scope="col" class="num">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (a of feed.content; track a.id) {
                        <tr [gz-row]="a">
                          <td>
                            <span class="cell-main">{{ label(a.activityType) }}</span>
                            @if (a.description) {
                              <span class="cell-sub">{{ a.description }}</span>
                            }
                          </td>
                          <td data-priority="2">{{ subjectWord(a) }}</td>
                          <td class="num">{{ day(a.createdAt) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <p class="cm-text">Activity on your clients, leads, tasks and deals appears here.</p>
                }
              </section>
            }
          </div>
        } @else if (kind(); as k) {
          @if (stageLinks(); as links) {
            <gz-stage-links [stages]="links" [active]="filter()" [param]="k === 'tasks' ? 'status' : 'stage'"
              [label]="k === 'tasks' ? 'Filter tasks by status' : 'Filter by stage'" />
          }
          <gz-request-status
            [loading]="list().loading && !rows().length"
            [loadingText]="'Loading your ' + noun[k][1] + '…'"
            [error]="list().error"
            (retry)="load(list().page)"
          />
          @if (rows().length) {
            <p class="cm-count" #count tabindex="-1">{{ countText() }}</p>
            <table
              gz-table
              class="cm-table"
              [(selected)]="selectedId"
              (activated)="openRecord($event)"
              (dismissed)="closePane()"
              [paneOpen]="pane() !== null"
              [attr.aria-busy]="list().loading ? 'true' : null"
            >
              <caption class="sr-only">{{ title() }}. Choose a row to open it.</caption>
              @switch (k) {
                @case ('clients') {
                  <thead><tr>
                    <th scope="col">Client</th>
                    <th scope="col" data-priority="2">Email</th>
                    <th scope="col" data-priority="2">Phone</th>
                    <th scope="col" class="num" data-priority="3">Added</th>
                  </tr></thead>
                  <tbody>
                    @for (c of clients(); track c.id) {
                      <tr [gz-row]="c.id">
                        <td><span class="cell-main">{{ c.name }}</span><span class="cell-sub m-only">{{ c.email || c.phone }}</span></td>
                        <td data-priority="2">{{ c.email }}</td>
                        <td data-priority="2" class="nowrap">{{ c.phone }}</td>
                        <td class="num" data-priority="3">{{ day(c.createdAt) }}</td>
                      </tr>
                    }
                  </tbody>
                }
                @case ('leads') {
                  <thead><tr>
                    <th scope="col">Lead</th>
                    <th scope="col">Stage</th>
                    <th scope="col" data-priority="2">Source</th>
                    <th scope="col" data-priority="3">Property</th>
                    <th scope="col" class="num" data-priority="2">Changed</th>
                  </tr></thead>
                  <tbody>
                    @for (l of leads(); track l.id) {
                      <tr [gz-row]="l.id">
                        <td><span class="cell-main">{{ l.title }}</span><span class="cell-sub">{{ clientName(l.clientId) }}</span></td>
                        <td [class.positive]="l.stage === 'CONVERTED'">{{ label(l.stage) }}</td>
                        <td data-priority="2">{{ source(l.source) }}</td>
                        <td data-priority="3">
                          @if (l.propertyId) {
                            <gz-property-ref [propertyId]="l.propertyId" [link]="false" />
                          }
                        </td>
                        <td class="num" data-priority="2">{{ day(l.updatedAt) }}</td>
                      </tr>
                    }
                  </tbody>
                }
                @case ('tasks') {
                  <thead><tr>
                    <th scope="col">Task</th>
                    <th scope="col">Due</th>
                    <th scope="col" data-priority="2">Status</th>
                    <th scope="col" data-priority="3">Client</th>
                  </tr></thead>
                  <tbody>
                    @for (t of tasks(); track t.id) {
                      <tr [gz-row]="t.id">
                        <td><span class="cell-main">{{ t.title }}</span><span class="cell-sub m-only">{{ label(t.status) }}</span></td>
                        <td class="nowrap">
                          @if (t.dueAt) {
                            {{ when(t.dueAt) }}
                            @if (t.overdue) {
                              <span class="cell-sub attention">Overdue</span>
                            }
                          } @else {
                            <span class="muted">No due date</span>
                          }
                        </td>
                        <td data-priority="2">{{ label(t.status) }}</td>
                        <td data-priority="3">{{ t.clientId ? clientName(t.clientId) : '' }}</td>
                      </tr>
                    }
                  </tbody>
                }
                @case ('deals') {
                  <thead><tr>
                    <th scope="col">Deal</th>
                    <th scope="col">Stage</th>
                    <th scope="col" data-priority="3">Property</th>
                    <th scope="col" class="num" data-priority="2">Expected close</th>
                  </tr></thead>
                  <tbody>
                    @for (d of deals(); track d.id) {
                      <tr [gz-row]="d.id">
                        <td><span class="cell-main">{{ d.title }}</span><span class="cell-sub">{{ clientName(d.clientId) }}</span></td>
                        <td [class.positive]="d.stage === 'CLOSED'" [class.muted]="d.stage === 'CANCELLED'">{{ label(d.stage) }}</td>
                        <td data-priority="3"><gz-property-ref [propertyId]="d.propertyId" [link]="false" /></td>
                        <td class="num" data-priority="2">
                          @if (d.closedAt) {
                            Closed {{ day(d.closedAt) }}
                          } @else if (d.expectedCloseDate) {
                            {{ calendar(d.expectedCloseDate) }}
                          } @else {
                            <span class="muted">Not set</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                }
              }
            </table>
            <gz-pager [page]="list().page" [size]="20" [total]="list().totalElements" [loading]="list().loading" (changed)="page($event)" />
            @if (unknownClients()) {
              <p class="table-note">Unavailable client names: the CRM loads your 100 newest clients for names.</p>
            }
          } @else if (!list().loading && !list().error) {
            <p class="cm-text">{{ emptyText() }}</p>
            @if (filter()) {
              <a class="btn" [routerLink]="[]" [queryParams]="{ stage: null, status: null }" queryParamsHandling="merge">Clear filter</a>
            } @else {
              <button type="button" class="btn primary" (click)="openNew()">New {{ noun[k][0] }}</button>
            }
          }
        }
      }

      @if (pane() === 'new' && kind(); as k) {
        <gz-record-pane deskSlot [heading]="'New ' + noun[k][0]" [noun]="noun[k][0]" [backLabel]="title()" (closed)="closePane()">
          <gz-crm-form [kind]="k" (done)="created()" />
        </gz-record-pane>
      } @else if (paneRecord(); as r) {
        <gz-record-pane
          deskSlot
          [heading]="recordTitle(r)"
          [noun]="noun[kind()!][0]"
          [backLabel]="title()"
          [position]="position()"
          [hasPrev]="paneIndex() > 0"
          [hasNext]="paneIndex() < rows().length - 1"
          (prev)="step(-1)"
          (next)="step(1)"
          (closed)="closePane()"
        >
          <span paneMeta>{{ recordMeta(r) }}</span>
          <div paneActions class="cm-pane-actions">
            @for (m of moves(r); track m.to) {
              <button type="button" class="btn" [class.primary]="m.primary"
                [attr.aria-disabled]="saving() ? 'true' : null" (click)="move(r, m.to)">{{ m.label }}</button>
            }
            @if (kind() === 'clients' || kind() === 'tasks') {
              <button type="button" class="btn" [attr.aria-disabled]="saving() ? 'true' : null" (click)="remove(r)">Delete</button>
            }
            @if (!moves(r).length && (kind() === 'leads' || kind() === 'deals')) {
              <p class="cm-why">Final stage: it can't be moved again.</p>
            }
          </div>
          @if (writeError(); as error) {
            <p class="field-error cm-pane-error" role="alert">{{ error }}</p>
          }
          @switch (kind()) {
            @case ('clients') {
              <gz-crm-client-record [client]="$any(r)" />
            }
            @case ('leads') {
              <gz-crm-lead-record [lead]="$any(r)" />
            }
            @case ('tasks') {
              <gz-crm-task-record [task]="$any(r)" />
            }
            @case ('deals') {
              <gz-crm-deal-record [deal]="$any(r)" />
            }
          }
        </gz-record-pane>
      }
    </gz-desk>`,
  styles: `
    .cm-guest {
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
      max-width: 720px;
    }
    h2 {
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    .cm-text {
      margin: var(--sp-8) 0 var(--sp-16);
      font-size: var(--fs-body);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .tabs {
      margin-bottom: var(--sp-16);
    }
    /* The tabs are links here (each is an address, /crm/:tab): the look of the global tab buttons. */
    .tabs a {
      position: relative;
      padding: 0 0 10px;
      white-space: nowrap;
      font-size: var(--fs-body);
      color: var(--ink-2);
      text-decoration: none;
    }
    .tabs a:hover {
      color: var(--ink);
    }
    .tabs a.active {
      color: var(--ink);
      font-weight: 500;
      box-shadow: inset 0 -2px 0 var(--copper);
    }
    .tabs a:focus-visible {
      outline-offset: -2px;
    }
    .cm-section {
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
      margin-bottom: var(--sp-24);
      min-width: 0;
    }
    .cm-section h2 {
      margin: 0 0 var(--sp-12);
    }
    .cm-caption {
      margin: calc(-1 * var(--sp-8)) 0 var(--sp-12);
      font-size: var(--fs-cell);
      color: var(--ink-2);
    }
    .cm-cols {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0 var(--sp-24);
      align-items: start;
    }
    .cm-count {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-cell);
      color: var(--ink-2);
      outline: none;
      scroll-margin-top: calc(var(--topbar-h) + var(--sp-8));
    }
    gz-stage-links {
      display: block;
      margin-bottom: var(--sp-12);
    }
    .cm-pane-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8);
    }
    .cm-why {
      flex-basis: 100%;
      margin: 0;
      font-size: var(--fs-caption);
      color: var(--ink-2);
    }
    .cm-pane-error {
      margin: var(--sp-8) 0;
    }
    @media (max-width: 1023.98px) {
      .cm-cols {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class Crm {
  readonly w = inject(Workspace);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly countEl = viewChild<ElementRef<HTMLElement>>('count');
  private readonly newButton = viewChild<ElementRef<HTMLElement>>('newButton');
  readonly crm = this.w.store.selectSignal(selectCrm);
  readonly clients = this.w.store.selectSignal(selectCrmClients);
  readonly leads = this.w.store.selectSignal(selectCrmLeads);
  readonly tasks = this.w.store.selectSignal(selectCrmTasks);
  readonly deals = this.w.store.selectSignal(selectCrmDeals);
  private readonly names = this.w.store.selectSignal(selectCrmClientNames);
  readonly tabs = TABS;
  readonly noun = NOUN;
  readonly label = crmLabel;
  readonly countOf = countOf;
  readonly when = when;
  readonly source = sourceWord;

  // The tab and its filter follow the address: /crm/:tab, ?stage= or ?status=.
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly tab = computed<CrmTab>(() => {
    const t = this.params().get('tab');
    return TABS.some(([key]) => key === t) ? (t as CrmTab) : 'overview';
  });
  readonly kind = computed<CrmKind | null>(() => (this.tab() === 'overview' ? null : (this.tab() as CrmKind)));
  /** The filter in the address, when the list has one and the value is one of its own. */
  readonly filter = computed<string | null>(() => {
    const k = this.kind();
    const value = this.query().get(k === 'tasks' ? 'status' : 'stage');
    const allowed: readonly string[] =
      k === 'leads' ? LEAD_STAGES : k === 'tasks' ? TASK_STATUSES : k === 'deals' ? DEAL_STAGES : [];
    return value && allowed.includes(value) ? value : null;
  });

  readonly title = computed(() => TABS.find(([key]) => key === this.tab())![1]);
  readonly subtitle = computed(() =>
    this.tab() === 'overview'
      ? 'Your clients, leads, follow-up tasks and deals, with what happened last.'
      : '',
  );
  readonly list = computed(() => {
    const s = this.crm();
    return s[this.kind() ?? 'clients'];
  });
  readonly rows = computed<AnyRecord[]>(() => {
    switch (this.kind()) {
      case 'clients':
        return this.clients();
      case 'leads':
        return this.leads();
      case 'tasks':
        return this.tasks();
      case 'deals':
        return this.deals();
      default:
        return [];
    }
  });
  readonly countText = computed(() => {
    const k = this.kind()!;
    const n = countOf(this.list().totalElements, NOUN[k][0], NOUN[k][1]);
    return this.filter() ? `${n} · ${crmLabel(this.filter())}` : n;
  });
  readonly emptyText = computed(() => {
    const k = this.kind()!;
    if (this.filter()) return `No ${NOUN[k][1]} in ${crmLabel(this.filter())}.`;
    return {
      clients: 'Clients you add appear here, with their notes and history.',
      leads: 'Leads you capture appear here and move from New to Converted.',
      tasks: 'Follow-up tasks you create appear here, overdue ones marked.',
      deals: 'Deals you create appear here and move through your pipeline.',
    }[k];
  });
  /** Stage or status links; counts from the CRM's own summaries, where it sends them. */
  readonly stageLinks = computed<StageLink[] | null>(() => {
    const s = this.crm();
    switch (this.kind()) {
      case 'leads':
        return [{ key: null, label: 'All', count: null }, ...LEAD_STAGES.map((st) => ({ key: st, label: crmLabel(st), count: null }))];
      case 'tasks': {
        const sum = s.summary;
        const count: Record<CrmTaskStatus, number | null> = {
          OPEN: sum?.open ?? null,
          IN_PROGRESS: sum?.inProgress ?? null,
          COMPLETED: sum?.completed ?? null,
          CANCELLED: sum?.cancelled ?? null,
        };
        return [{ key: null, label: 'All', count: sum?.total ?? null }, ...TASK_STATUSES.map((st) => ({ key: st, label: crmLabel(st), count: count[st] }))];
      }
      case 'deals': {
        const p = s.pipeline;
        return [{ key: null, label: 'All', count: p?.total ?? null }, ...DEAL_STAGES.map((st) => ({ key: st, label: crmLabel(st), count: p?.stages[st] ?? null }))];
      }
      default:
        return null;
    }
  });
  readonly pipelineRows = computed<StageRow[]>(() => {
    const p = this.crm().pipeline;
    return DEAL_STAGES.map((stage) => ({
      key: stage,
      label: crmLabel(stage),
      count: p?.stages[stage] ?? 0,
      muted: stage === 'CANCELLED',
    }));
  });

  // The pane: the selected record (it follows the table's selection) or a New form.
  readonly selectedId = signal<unknown>(null);
  readonly pane = signal<'record' | 'new' | null>(null);
  readonly paneIndex = computed(() => this.rows().findIndex((r) => r.id === this.selectedId()));
  readonly paneRecord = computed(() => (this.pane() === 'record' ? (this.rows()[this.paneIndex()] ?? null) : null));
  readonly paneLabel = computed(() => {
    const k = this.kind();
    if (!k) return 'Record';
    return this.pane() === 'new' ? 'New ' + NOUN[k][0] : this.paneRecord() ? this.recordTitle(this.paneRecord()!) : 'Record';
  });
  readonly position = computed(() =>
    this.paneIndex() < 0 ? '' : `${this.paneIndex() + 1} of ${this.rows().length} on this page`,
  );
  readonly saving = computed(() => this.crm().saving > 0);

  private focusCount = false;
  /** The last write sent from this page and the record it was for (null: no record, a list action). */
  private readonly lastWrite = signal<{ id: number | null } | null>(null);
  readonly writeError = computed(() => {
    const s = this.crm();
    const w = this.lastWrite();
    if (!w || s.saving || !s.saveError) return null;
    const open = this.paneRecord();
    // On the page when no pane is open; in the pane only for the record the write was for.
    return this.pane() === null || (open && open.id === w.id) ? s.saveError : null;
  });
  /** ?new=1 (the realtor overview's New task, New lead…): the New form opens on arrival. */
  private askNew = this.route.snapshot.queryParamMap.get('new') === '1';
  /**
   * An activity's record (?open=<id>, set by the overview, which is another route): opened once
   * its list has loaded, if it is on that page; the parameter is then dropped.
   */
  private pendingOpen: number | null = Number(this.route.snapshot.queryParamMap.get('open')) || null;

  constructor() {
    // The CRM's pickers and summaries once, then the tab's list whenever the tab or filter changes.
    let started = false;
    effect(() => {
      if (!this.w.auth.isLoggedIn()) return;
      const k = this.kind();
      const filter = this.filter();
      untracked(() => {
        if (!started) {
          started = true;
          this.w.store.dispatch(A.loadOptions());
          this.w.store.dispatch(A.loadOverview());
        } else if (!k) this.w.store.dispatch(A.loadOverview());
        this.pane.set(null);
        this.selectedId.set(null);
        this.lastWrite.set(null);
        this.w.store.dispatch(A.closeHistory());
        if (k) this.load(0, filter);
        if (this.askNew && k) {
          this.askNew = false;
          this.pane.set('new');
          void this.router.navigate([], { relativeTo: this.route, queryParams: { new: null }, queryParamsHandling: 'merge', replaceUrl: true });
        }
      });
    });
    // Another record in the pane: an earlier write's error is not its own.
    effect(() => {
      this.paneRecord()?.id;
      untracked(() => {
        const w = this.lastWrite();
        if (w && w.id !== null && w.id !== this.paneRecord()?.id) this.lastWrite.set(null);
      });
    });
    // A record that left the list (deleted, another page or filter) closes its pane.
    effect(() => {
      if (this.pane() === 'record' && !this.paneRecord()) untracked(() => this.closePane(true));
    });
    // After paging, the list starts from its count, which takes focus (DESIGN.md §7 paging).
    effect(() => {
      if (this.list().loading || !this.focusCount) return;
      this.focusCount = false;
      untracked(() => {
        const el = this.countEl()?.nativeElement;
        el?.scrollIntoView?.({ block: 'start' });
        el?.focus({ preventScroll: true });
      });
    });
    // An activity's record, once its list has loaded: opened if it is on the page.
    effect(() => {
      const list = this.list();
      if (this.pendingOpen === null || list.loading || !list.loaded) return;
      const id = this.pendingOpen;
      this.pendingOpen = null;
      untracked(() => {
        if (this.rows().some((r) => r.id === id)) this.openRecord(id);
        else this.w.toast('That record isn’t on the first page of this list, or it was deleted.');
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { open: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  load(page: number, filter = this.filter()) {
    switch (this.kind()) {
      case 'clients':
        this.w.store.dispatch(A.loadClients({ page }));
        return;
      case 'leads':
        this.w.store.dispatch(A.loadLeads({ page, stage: filter as LeadStage | null }));
        return;
      case 'tasks':
        this.w.store.dispatch(A.loadTasks({ page, status: filter as CrmTaskStatus | null }));
        return;
      case 'deals':
        this.w.store.dispatch(A.loadDeals({ page, stage: filter as CrmTransactionStage | null }));
        return;
    }
  }
  page(page: number) {
    this.focusCount = true;
    this.pane.set(null);
    this.load(page);
  }
  loadOverview() {
    this.w.store.dispatch(A.loadOverview());
  }

  openRecord(id: unknown) {
    this.selectedId.set(id);
    this.pane.set('record');
  }
  openNew() {
    this.selectedId.set(null);
    this.pane.set('new');
  }
  /** A New form saved: the pane closes, focus goes back to New …, and the list reloads (effects). */
  created() {
    this.closePane(true);
  }
  closePane(toNew = false) {
    const was = this.pane();
    if (!was) return;
    this.pane.set(null);
    this.w.store.dispatch(A.closeHistory());
    // Once the register is back (not inert, not hidden): the row the pane showed, or New ….
    afterNextRender(
      () => {
        const row = document.querySelector<HTMLElement>('.cm-table tr.gz-row.sel');
        (was === 'record' && row && !toNew ? row : this.newButton()?.nativeElement)?.focus({ preventScroll: false });
      },
      { injector: this.injector },
    );
  }
  step(by: number) {
    const next = this.rows()[this.paneIndex() + by];
    if (next) this.openRecord(next.id);
  }
  /** An activity row: its record's list, with the record opened when it is on that page. */
  view(a: unknown) {
    const activity = a as CrmActivityDTO;
    if (activity.activityType === 'CLIENT_DELETED' || activity.activityType === 'TASK_DELETED') {
      this.w.toast('That record was deleted.');
      return;
    }
    void this.router.navigate(['/crm', TAB_OF[activity.subjectType]], { queryParams: { open: activity.subjectId } });
  }

  /** The record's next stages (or statuses) as buttons; the way forward is primary. */
  moves(r: AnyRecord): { to: string; label: string; primary: boolean }[] {
    switch (this.kind()) {
      case 'leads': {
        const l = r as CrmLeadDTO;
        return nextLeadStages(l.stage).map((to) => ({ to, label: leadAction(to), primary: isForward(to) }));
      }
      case 'tasks': {
        const t = r as CrmTaskDTO;
        return nextTaskStatuses(t.status).map((to) => ({ to, label: taskAction(t.status, to), primary: to === 'COMPLETED' }));
      }
      case 'deals': {
        const d = r as CrmTransactionDTO;
        return nextDealStages(d.stage).map((to) => ({ to, label: dealAction(to), primary: isForward(to) }));
      }
      default:
        return [];
    }
  }
  async move(r: AnyRecord, to: string) {
    if (this.saving() || !this.w.requireAccount('update your CRM')) return;
    const k = this.kind();
    const final =
      (k === 'leads' && (to === 'CONVERTED' || to === 'LOST')) || (k === 'deals' && (to === 'CLOSED' || to === 'CANCELLED'));
    if (final) {
      const ok = await this.confirmation.confirm(
        k === 'leads'
          ? {
              title: to === 'CONVERTED' ? 'Mark lead as converted?' : 'Mark lead as lost?',
              message: 'This is a final stage and can’t be changed later. Notes and details stay editable.',
              confirmLabel: to === 'CONVERTED' ? 'Mark converted' : 'Mark lost',
            }
          : {
              title: to === 'CLOSED' ? 'Close this deal?' : 'Cancel this deal?',
              message: 'Closed and cancelled deals can’t be reopened. This only updates your pipeline; no property or payment is transferred.',
              confirmLabel: to === 'CLOSED' ? 'Close deal' : 'Cancel deal',
            },
      );
      if (!ok || this.destroy.destroyed || this.saving()) return;
    }
    this.lastWrite.set({ id: r.id });
    document.querySelector<HTMLElement>('.desk-slot .pane-title')?.focus();
    if (k === 'leads') this.w.store.dispatch(A.updateLead({ id: r.id, request: { stage: to as LeadStage } }));
    if (k === 'tasks') this.w.store.dispatch(A.updateTask({ id: r.id, request: { status: to as CrmTaskStatus } }));
    if (k === 'deals') this.w.store.dispatch(A.updateDeal({ id: r.id, request: { stage: to as CrmTransactionStage } }));
  }
  async remove(r: AnyRecord) {
    if (this.saving()) return;
    const k = this.kind();
    const ok = await this.confirmation.confirm(
      k === 'clients'
        ? {
            title: 'Delete client?',
            message: `Delete "${(r as CrmClientDTO).name}"? A client linked to a lead, task or deal can't be deleted. Their activity history is kept.`,
          }
        : { title: 'Delete task?', message: `Delete "${(r as CrmTaskDTO).title}"? Linked clients, leads and deals are not changed.` },
    );
    if (!ok || this.destroy.destroyed || this.saving() || !this.w.requireAccount('delete CRM records')) return;
    // The pane and its row go: focus moves to New … once the register is back.
    this.lastWrite.set({ id: null });
    this.closePane(true);
    if (k === 'clients') this.w.store.dispatch(A.deleteClient({ id: r.id }));
    if (k === 'tasks') this.w.store.dispatch(A.deleteTask({ id: r.id }));
  }

  recordTitle(r: AnyRecord) {
    return 'name' in r ? r.name : r.title;
  }
  recordMeta(r: AnyRecord) {
    if ('stage' in r) return crmLabel(r.stage) + ('clientId' in r ? ' · ' + this.clientName(r.clientId) : '');
    if ('status' in r) return crmLabel(r.status) + (r.overdue ? ' · Overdue' : '');
    return [r.email, r.phone].filter(Boolean).join(' · ');
  }
  clientName(id: number | null) {
    return id === null ? '' : (this.names()[id] ?? 'Client: Unavailable');
  }
  /** Some row's client isn't among the names the CRM loads (its 100 newest clients). */
  readonly unknownClients = computed(() =>
    this.rows().some((r) => 'clientId' in r && r.clientId !== null && !this.names()[r.clientId]),
  );
  subjectWord(a: CrmActivityDTO) {
    return { CLIENT: 'Client', LEAD: 'Lead', TASK: 'Task', TRANSACTION: 'Deal' }[a.subjectType];
  }
  day(v: string | null | undefined) {
    return formatLocalDate(v);
  }
  /** A calendar date (expectedCloseDate), as written. */
  calendar(v: string) {
    return formatRecordDate(v);
  }
}
