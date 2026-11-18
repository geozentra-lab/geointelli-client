import { Component, computed, effect, inject, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardOverview } from '../dashboard-overview';
import { Workspace } from '../../../shared/data/workspace';
import { Icon } from '../../../shared/components/icon/icon';
import { labelFor } from '../../../shared/pipes/label.pipe';
import { DEAL_STAGES, LEAD_STAGES, crmLabel } from '../../../core/models/crm';
import { RealtorDashboardActions as A } from '../../../store/realtor-dashboard/realtor-dashboard.actions';
import { selectRealtorDashboard } from '../../../store/realtor-dashboard/realtor-dashboard.selectors';
import { Kpi, RecentActivity, StageBars, StageRow } from '../dash-ui';

/**
 * Realtor (SOW II.4.o): the clients-and-leads and tasks-and-pipeline cards of the realtor
 * dashboard, the CRM activity feed and the license verification status. Every card opens the
 * matching CRM tab.
 */
@Component({
  selector: 'gz-realtor-dashboard',
  imports: [DashboardOverview, Kpi, StageBars, RecentActivity, DatePipe, RouterLink, Icon],
  template: `@if (signedIn()) {
      @switch (license()) {
        @case ('VERIFIED') {}
        @case ('PENDING_REVIEW') {
          <p class="insight section" role="status">
            Your realtor license is under review. Buyers see it as verified once it is approved.
          </p>
        }
        @case ('REJECTED') {
          <p class="insight warning section" role="status">
            Your realtor license could not be verified.
            <a routerLink="/settings" fragment="license">See why and submit it again</a>.
          </p>
        }
        @default {
          <p class="insight section" role="status">
            Verify your Florida realtor license so clients know who they are working with.
            <a routerLink="/settings" fragment="license">Verify your license</a>.
          </p>
        }
      }
      @let cl = d().clientsLeads.value;
      @let tp = d().tasksPipeline.value;
      <div class="kpi-row section">
        <gz-kpi
          label="New leads"
          icon="spark"
          link="/crm/leads"
          [query]="{ stage: 'NEW' }"
          [loading]="d().clientsLeads.loading && !cl"
          [value]="cl ? cl.leads.byStage.NEW : null"
          [caption]="cl ? cl.leads.open + ' open of ' + cl.leads.total + ' leads' : ''"
        />
        <gz-kpi
          label="Clients"
          icon="user"
          tone="ink"
          link="/crm/clients"
          [loading]="d().clientsLeads.loading && !cl"
          [value]="cl ? cl.clients.total : null"
          caption="People in your CRM"
        />
        <gz-kpi
          label="Open tasks"
          icon="check"
          [tone]="tp && tp.tasks.summary.overdue > 0 ? 'amber' : 'green'"
          link="/crm/tasks"
          [loading]="d().tasksPipeline.loading && !tp"
          [value]="tp ? tp.tasks.summary.open + tp.tasks.summary.inProgress : null"
          [caption]="
            tp
              ? tp.tasks.summary.overdue
                ? tp.tasks.summary.overdue + ' overdue'
                : 'None overdue'
              : ''
          "
        />
        <gz-kpi
          label="Deals in progress"
          icon="brief"
          tone="copper"
          link="/crm/deals"
          [loading]="d().tasksPipeline.loading && !tp"
          [value]="tp ? tp.pipeline.open : null"
          [caption]="tp ? tp.pipeline.byStage.CLOSED + ' closed' : ''"
        />
      </div>
      @if (cardError(); as error) {
        <div class="insight danger section" role="alert">
          {{ error }}
          <button type="button" class="btn small" (click)="load()">Retry</button>
        </div>
      }
      <div class="dash-grid section">
        <div class="dash-main">
          <section class="panel dash-card" aria-labelledby="card-pipeline">
            <div class="panelhead">
              <div>
                <h3 id="card-pipeline">Transaction pipeline</h3>
                @if (tp) {
                  <p class="smalltext muted">
                    {{ tp.pipeline.total }} deals · updated {{ tp.generatedAt | date: 'shortTime' }}
                  </p>
                }
              </div>
              <a class="smalltext" routerLink="/crm/deals">Open deals</a>
            </div>
            @if (d().tasksPipeline.loading && !tp) {
              @for (i of [1, 2, 3, 4]; track i) {
                <div class="row-skeleton"></div>
              }
            } @else if (tp && tp.pipeline.total) {
              <gz-stage-bars
                [rows]="dealRows()"
                link="/crm/deals"
                param="stage"
                label="Deals by stage"
              />
            } @else if (tp) {
              <div class="empty-state">
                <gz-icon name="brief" />
                <p>Create a deal from a client to follow it from viewing to closing.</p>
                <a class="btn small" routerLink="/crm/deals">Add a deal</a>
              </div>
            }
          </section>
          <section class="panel dash-card" aria-labelledby="card-leads">
            <div class="panelhead">
              <div>
                <h3 id="card-leads">Leads</h3>
                @if (cl) {
                  <p class="smalltext muted">
                    {{ cl.leads.open }} in progress · {{ cl.leads.total }} in total
                  </p>
                }
              </div>
              <a class="smalltext" routerLink="/crm/leads">All leads</a>
            </div>
            @if (d().clientsLeads.loading && !cl) {
              @for (i of [1, 2, 3]; track i) {
                <div class="row-skeleton"></div>
              }
            } @else if (cl) {
              @if (cl.leads.total) {
                <gz-stage-bars
                  [rows]="leadRows()"
                  link="/crm/leads"
                  param="stage"
                  label="Leads by stage"
                />
              }
              <h4 class="dash-subhead">Newest leads</h4>
              <ul class="list">
                @for (l of cl.leads.recent; track l.id) {
                  <li>
                    <a routerLink="/crm/leads">
                      <span class="list-main">
                        <b>{{ l.title }}</b>
                        <small class="muted"
                          >{{ l.clientName }} · {{ source(l.source) }} ·
                          {{ l.createdAt | date: 'MMM d' }}</small
                        >
                      </span>
                      <span
                        class="tag"
                        [class.green]="l.stage === 'CONVERTED'"
                        [class.amber]="l.stage === 'NEW'"
                        >{{ label(l.stage) }}</span
                      >
                    </a>
                  </li>
                } @empty {
                  <li class="empty-line">
                    No leads yet. Contact requests from buyers arrive here.
                  </li>
                }
              </ul>
            }
          </section>
          <section class="panel dash-card" aria-labelledby="card-clients">
            <div class="panelhead">
              <h3 id="card-clients">Newest clients</h3>
              <a class="smalltext" routerLink="/crm/clients">All clients</a>
            </div>
            @if (cl) {
              <ul class="list">
                @for (c of cl.clients.recent; track c.id) {
                  <li>
                    <a routerLink="/crm/clients">
                      <span class="list-main">
                        <b>{{ c.name }}</b>
                        <small class="muted">{{
                          c.email || c.phone || 'No contact details'
                        }}</small>
                      </span>
                      <time class="smalltext muted" [attr.datetime]="c.createdAt">{{
                        c.createdAt | date: 'MMM d'
                      }}</time>
                    </a>
                  </li>
                } @empty {
                  <li class="empty-line">Add a client in the CRM to start tracking them.</li>
                }
              </ul>
            }
          </section>
        </div>
        <div class="dash-side">
          <section class="panel dash-card" aria-labelledby="card-tasks">
            <div class="panelhead">
              <div>
                <h3 id="card-tasks">Tasks due</h3>
                @if (tp) {
                  <p class="smalltext muted">
                    Overdue, and due in the next {{ tp.tasks.window.days }} days
                  </p>
                }
              </div>
              <a class="smalltext" routerLink="/crm/tasks">All tasks</a>
            </div>
            @if (tp) {
              <ul class="list">
                @for (t of tp.tasks.overdue; track t.id) {
                  <li>
                    <a routerLink="/crm/tasks">
                      <span class="list-main">
                        <b>{{ t.title }}</b>
                        <small class="amber">Overdue · {{ t.dueAt | date: 'MMM d' }}</small>
                      </span>
                      <gz-icon name="clock" />
                    </a>
                  </li>
                }
                @for (t of tp.tasks.dueSoon; track t.id) {
                  <li>
                    <a routerLink="/crm/tasks">
                      <span class="list-main">
                        <b>{{ t.title }}</b>
                        <small class="muted"
                          >Due {{ t.dueAt | date: 'MMM d, h:mm a' }} · {{ label(t.status) }}</small
                        >
                      </span>
                      <gz-icon name="check" />
                    </a>
                  </li>
                }
                @if (!tp.tasks.overdue.length && !tp.tasks.dueSoon.length) {
                  <li class="empty-line">Nothing due this week. You're all caught up.</li>
                }
              </ul>
              @if (hiddenDue(); as more) {
                <p class="sourcedata">
                  {{ more }} more due soon. Tasks without a due date are counted, not listed.
                </p>
              }
            }
          </section>
          <section class="panel dash-card" aria-labelledby="card-crm-activity">
            <div class="panelhead">
              <h3 id="card-crm-activity">Client activity</h3>
              <a class="smalltext" routerLink="/crm">CRM</a>
            </div>
            @if (d().activity.value; as page) {
              <ul class="feed">
                @for (a of page.content; track a.id) {
                  <li>
                    <span class="feed-row">
                      <span class="feed-dot"><gz-icon name="clock" /></span>
                      <span class="feed-text">
                        <b>{{ label(a.activityType) }}</b>
                        @if (a.description) {
                          <small>{{ a.description }}</small>
                        }
                      </span>
                      <time class="smalltext muted">{{ a.createdAt | date: 'MMM d' }}</time>
                    </span>
                  </li>
                } @empty {
                  <li class="empty-line">Notes, stage changes and new deals will appear here.</li>
                }
              </ul>
            } @else if (d().activity.loading) {
              @for (i of [1, 2, 3]; track i) {
                <div class="row-skeleton"></div>
              }
            }
          </section>
          <gz-recent-activity />
        </div>
      </div>
    }
    <gz-dashboard-overview [compact]="false" />`,
})
export class RealtorDashboard {
  w = inject(Workspace);
  d = this.w.store.selectSignal(selectRealtorDashboard);
  signedIn = computed(() => this.w.auth.isLoggedIn() && !!this.w.account().profile);
  license = computed(() => this.w.account().profile?.realtorLicenseStatus ?? null);
  label = crmLabel;
  /** WEBSITE → "Website": sources are open-ended codes, not CRM enums. */
  source = labelFor;
  /** The first card error, shown once above the cards with a single retry. */
  cardError = computed(() => {
    const s = this.d();
    return s.clientsLeads.error ?? s.tasksPipeline.error ?? s.activity.error;
  });
  dealRows = computed<StageRow[]>(() => {
    const st = this.d().tasksPipeline.value?.pipeline.byStage;
    return DEAL_STAGES.map((k) => ({
      key: k,
      label: crmLabel(k),
      count: st?.[k] ?? 0,
      muted: k === 'CANCELLED',
    }));
  });
  leadRows = computed<StageRow[]>(() => {
    const st = this.d().clientsLeads.value?.leads.byStage;
    return LEAD_STAGES.map((k) => ({
      key: k,
      label: crmLabel(k),
      count: st?.[k] ?? 0,
      muted: k === 'LOST',
    }));
  });
  /** Tasks due inside the window beyond the ones listed. */
  hiddenDue = computed(() => {
    const t = this.d().tasksPipeline.value?.tasks;
    return t ? Math.max(0, t.dueSoonCount - t.dueSoon.length) : 0;
  });
  constructor() {
    effect(() => {
      if (this.signedIn()) untracked(() => this.load());
    });
  }
  load() {
    this.w.store.dispatch(A.load());
  }
}
