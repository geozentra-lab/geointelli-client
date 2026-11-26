import { Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../../shared/data/workspace';
import { PageHeading } from '../../../shared/components/page-heading';
import { TABLE_KIT } from '../../../shared/table';
import { countOf, formatLocalDate } from '../../../shared/data/format';
import { DEAL_STAGES, LEAD_STAGES, crmLabel } from '../../../core/models/crm';
import { RealtorTaskItem } from '../../../core/models/dashboard';
import { RealtorDashboardActions as A } from '../../../store/realtor-dashboard/realtor-dashboard.actions';
import { selectRealtorDashboard } from '../../../store/realtor-dashboard/realtor-dashboard.selectors';
import { StageBars, StageRow } from '../dash-ui';
import { OVERVIEW_STYLES, OverviewSection } from '../overview-ui';

type TaskRow = RealtorTaskItem & { overdue: boolean };
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * Realtor overview (DESIGN.md §8): the lead is "Overdue and due this week", the tasks of the realtor
 * tasks-pipeline card (overdue first, then due in its window), each linking to Tasks; then two
 * columns: deals and leads by stage (ordinal ramp, each stage opens the filtered CRM list) and the
 * CRM activity feed. Tasks are marked done in Tasks: the CRM slice that can update a task is not
 * registered on this route, so the overview has no "Mark done" (PROGRESS.md, needs store work).
 */
@Component({
  selector: 'gz-realtor-dashboard',
  imports: [RouterLink, PageHeading, StageBars, OverviewSection, ...TABLE_KIT],
  template: `<gz-heading title="CRM" />
    @switch (license()) {
      @case ('VERIFIED') {}
      @case ('PENDING_REVIEW') {
        <p class="insight ov-notice" role="status">
          <span>Your realtor license is under review. Buyers see it as verified once it is approved.</span>
        </p>
      }
      @case ('REJECTED') {
        <p class="insight warning ov-notice" role="status">
          <span
            >Your realtor license could not be verified.
            <a routerLink="/settings" fragment="license">See why and submit it again</a>.</span
          >
        </p>
      }
      @default {
        <p class="insight ov-notice" role="status">
          <span
            >Verify your Florida realtor license so clients know who they are working with.
            <a routerLink="/settings" fragment="license">Verify your license</a>.</span
          >
        </p>
      }
    }
    @let tp = d().tasksPipeline.value;
    @let cl = d().clientsLeads.value;
    <section
      gz-overview-section
      #tasksSection
      heading="Overdue and due this week"
      [caption]="tasksCaption()"
      [busy]="d().tasksPipeline.loading && !!tp"
    >
      @if (rows().length && !d().tasksPipeline.error) {
        <a actions class="btn" routerLink="/crm/tasks" [queryParams]="{ new: 1 }">New task</a>
      }
      @if (d().tasksPipeline.error) {
        <div class="insight danger ov-alert" role="alert">
          <span>Tasks could not load.</span>
          <button type="button" class="btn small" (click)="tasksSection.retried(); load()">Retry</button>
        </div>
      } @else if (!tp) {
        @for (i of skeleton; track i) {
          <div class="row-skeleton" aria-hidden="true"></div>
        }
        <p class="sr-only" role="status">Loading tasks…</p>
      } @else if (!rows().length) {
        <div class="ov-empty">
          <p>No tasks due in the next {{ countOf(tp.tasks.window.days, 'day') }}.</p>
          <a class="btn primary" routerLink="/crm/tasks" [queryParams]="{ new: 1 }">New task</a>
        </div>
      } @else {
        <table gz-table class="ov-table" sticky="none">
          <caption class="sr-only">
            Tasks overdue and due in the next {{ countOf(tp.tasks.window.days, 'day') }}, earliest first
          </caption>
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Due</th>
              <th scope="col" data-priority="2">Status</th>
            </tr>
          </thead>
          <tbody>
            @for (t of rows(); track t.id) {
              <tr>
                <td>
                  <a routerLink="/crm/tasks">{{ t.title }}</a>
                  <span class="cell-sub m-only">{{ label(t.status) }}</span>
                </td>
                <td class="nowrap">
                  @if (t.overdue) {
                    <span class="rt-overdue">Overdue</span>
                    <span class="cell-sub">Due {{ day(t.dueAt) }}</span>
                  } @else {
                    <time [attr.datetime]="t.dueAt">{{ dueText(t.dueAt) }}</time>
                  }
                </td>
                <td data-priority="2">{{ label(t.status) }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (moreText(); as more) {
          <p class="ov-note">{{ more }} <a routerLink="/crm/tasks">Tasks lists every one.</a></p>
        }
        <p class="ov-note">
          Mark tasks done in Tasks. Tasks without a due date are counted there, not listed here.
        </p>
      }
    </section>
    <div class="ov-cols">
      <section
        gz-overview-section
        #pipelineSection
        heading="Pipeline by stage"
        [caption]="dealsCaption()"
        [busy]="(d().tasksPipeline.loading && !!tp) || (d().clientsLeads.loading && !!cl)"
      >
        <a actions class="ov-link" routerLink="/crm/deals">Open deals</a>
        @if (d().tasksPipeline.error) {
          <div class="insight danger ov-alert" role="alert">
            <span>Deals could not load.</span>
            <button type="button" class="btn small" (click)="pipelineSection.retried(); load()">
              Retry
            </button>
          </div>
        } @else if (!tp) {
          @for (i of skeleton; track i) {
            <div class="row-skeleton" aria-hidden="true"></div>
          }
        } @else if (!tp.pipeline.total) {
          <div class="ov-empty">
            <p>Deals you follow from viewing to closing will appear here by stage.</p>
            <a class="btn" routerLink="/crm/deals" [queryParams]="{ new: 1 }">New deal</a>
          </div>
        } @else {
          <gz-stage-bars [rows]="dealRows()" link="/crm/deals" param="stage" label="Deals by stage" />
        }
        <h3 class="ov-sub">Leads</h3>
        @if (d().clientsLeads.error) {
          <div class="insight danger ov-alert" role="alert">
            <span>Leads could not load.</span>
            <button type="button" class="btn small" (click)="pipelineSection.retried(); load()">
              Retry
            </button>
          </div>
        } @else if (!cl) {
          @for (i of skeleton; track i) {
            <div class="row-skeleton" aria-hidden="true"></div>
          }
        } @else if (!cl.leads.total) {
          <div class="ov-empty">
            <p>Leads appear here by stage, including contact requests from buyers.</p>
            <a class="btn" routerLink="/crm/leads" [queryParams]="{ new: 1 }">New lead</a>
          </div>
        } @else {
          <p class="ov-note rt-count">
            {{ countOf(cl.leads.total, 'lead') }}, {{ cl.leads.open }} open
          </p>
          <gz-stage-bars [rows]="leadRows()" link="/crm/leads" param="stage" label="Leads by stage" />
        }
      </section>
      @let act = d().activity;
      <section
        gz-overview-section
        #activitySection
        heading="Recent activity"
        [caption]="activityCaption()"
        [busy]="act.loading && !!act.value"
      >
        <a actions class="ov-link" routerLink="/crm/clients">Open clients</a>
        @if (act.error) {
          <div class="insight danger ov-alert" role="alert">
            <span>Activity could not load.</span>
            <button type="button" class="btn small" (click)="activitySection.retried(); load()">
              Retry
            </button>
          </div>
        } @else if (!act.value) {
          @for (i of skeleton; track i) {
            <div class="row-skeleton" aria-hidden="true"></div>
          }
        } @else if (!act.value.content.length) {
          <div class="ov-empty">
            <p>Notes, stage changes and new clients, leads and deals will appear here.</p>
            <a class="btn" routerLink="/crm/clients" [queryParams]="{ new: 1 }">Add a client</a>
          </div>
        } @else {
          <ul class="feed">
            @for (a of act.value.content; track a.id) {
              <li>
                <span class="feed-row">
                  <span class="feed-text">
                    <b>{{ label(a.activityType) }}</b>
                    @if (a.description) {
                      <small>{{ a.description }}</small>
                    }
                  </span>
                  <time class="smalltext muted" [attr.datetime]="a.createdAt">{{
                    day(a.createdAt)
                  }}</time>
                </span>
              </li>
            }
          </ul>
        }
      </section>
    </div>`,
  styles: [
    OVERVIEW_STYLES,
    `
      .ov-notice {
        margin-bottom: var(--sp-24);
      }
      .rt-overdue {
        color: var(--attention);
        font-weight: 600;
      }
      .rt-count {
        margin: 0 0 var(--sp-8);
      }
      .feed-text small {
        white-space: normal;
      }
    `,
  ],
})
export class RealtorDashboard {
  readonly w = inject(Workspace);
  readonly d = this.w.store.selectSignal(selectRealtorDashboard);
  readonly skeleton = [0, 1, 2];
  readonly license = computed(() => this.w.account().profile?.realtorLicenseStatus ?? null);
  readonly label = crmLabel;
  readonly countOf = countOf;
  /** Overdue first, then due inside the window, each in the card's order (earliest first). */
  readonly rows = computed<TaskRow[]>(() => {
    const t = this.d().tasksPipeline.value?.tasks;
    if (!t) return [];
    return [
      ...t.overdue.map((x) => ({ ...x, overdue: true })),
      ...t.dueSoon.map((x) => ({ ...x, overdue: false })),
    ];
  });
  readonly tasksCaption = computed(() => {
    const t = this.d().tasksPipeline.value?.tasks;
    if (!t || this.d().tasksPipeline.error || !this.rows().length) return '';
    const overdue = t.summary.overdue ? `${t.summary.overdue} overdue` : 'None overdue';
    return `${overdue} · ${t.dueSoonCount} due in the next ${countOf(t.window.days, 'day')}`;
  });
  /**
   * When the card lists fewer tasks than it counts (it lists the first few of each group): the rows
   * on screen against the card's own counts, never a computed remainder.
   */
  readonly moreText = computed(() => {
    const t = this.d().tasksPipeline.value?.tasks;
    if (!t) return '';
    if (t.overdue.length >= t.summary.overdue && t.dueSoon.length >= t.dueSoonCount) return '';
    return (
      `Listed: ${t.overdue.length} of ${t.summary.overdue} overdue and ${t.dueSoon.length} of ` +
      `${t.dueSoonCount} due in the next ${countOf(t.window.days, 'day')}.`
    );
  });
  readonly activityCaption = computed(() =>
    this.d().activity.value?.content.length && !this.d().activity.error
      ? 'Notes, stage changes and new records in your CRM'
      : '',
  );
  readonly dealsCaption = computed(() => {
    const p = this.d().tasksPipeline.value?.pipeline;
    return p && p.total && !this.d().tasksPipeline.error
      ? `${countOf(p.total, 'deal')}, ${p.open} in progress`
      : '';
  });
  readonly dealRows = computed<StageRow[]>(() => {
    const st = this.d().tasksPipeline.value?.pipeline.byStage;
    return DEAL_STAGES.map((k) => ({
      key: k,
      label: crmLabel(k),
      count: st?.[k] ?? 0,
      muted: k === 'CANCELLED',
    }));
  });
  readonly leadRows = computed<StageRow[]>(() => {
    const st = this.d().clientsLeads.value?.leads.byStage;
    return LEAD_STAGES.map((k) => ({
      key: k,
      label: crmLabel(k),
      count: st?.[k] ?? 0,
      muted: k === 'LOST',
    }));
  });
  /** A boolean, so the cards load once when the account arrives, not on every account change. */
  private readonly signedIn = computed(() => this.w.auth.isLoggedIn() && !!this.w.account().profile);
  constructor() {
    effect(() => {
      if (this.signedIn()) untracked(() => this.load());
    });
  }
  load() {
    this.w.store.dispatch(A.load());
  }
  /** "Nov 9", or "Oct 16, 2025" outside the current year (DESIGN.md §13), on the viewer's day. */
  day(value: string) {
    return formatLocalDate(value) ?? '';
  }
  dueText(value: string) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : `${this.day(value)}, ${TIME.format(d)}`;
  }
}
