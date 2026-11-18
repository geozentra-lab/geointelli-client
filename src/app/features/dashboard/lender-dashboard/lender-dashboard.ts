import { Component, computed, effect, inject, untracked } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DashboardOverview } from '../dashboard-overview';
import { Workspace } from '../../../shared/data/workspace';
import { Icon } from '../../../shared/components/icon/icon';
import {
  LENDER_STAGES,
  LTV_REASONS,
  LenderApplicationStage,
  LenderCollateralAnalysisDTO,
  TERMINAL_LENDER_STAGES,
  lenderStageLabels,
  loanTypeLabels,
} from '../../../core/models/lender';
import { LenderDashboardActions as A } from '../../../store/lender-dashboard/lender-dashboard.actions';
import { selectLenderDashboard } from '../../../store/lender-dashboard/lender-dashboard.selectors';
import { Kpi, RecentActivity, StageBars, StageRow, usdCompact } from '../dash-ui';
import { MortgageContextCard } from '../finance-cards';

const OPEN_STAGES: LenderApplicationStage[] = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'];

/**
 * Bank / mortgage lender (SOW II.4.o): pipeline and volumes of the selected lending organization,
 * approved and funded amounts with the funded loan mix over a period, recent applications with the
 * loan-to-value of their collateral, and mortgage context. Tracking only: nothing here is a credit
 * decision.
 */
@Component({
  selector: 'gz-lender-dashboard',
  imports: [
    DashboardOverview,
    Kpi,
    StageBars,
    RecentActivity,
    MortgageContextCard,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    Icon,
  ],
  template: `@if (signedIn()) {
      @let orgList = d().organizations.value;
      @if (orgList && orgList.length > 1) {
        <div class="dash-switch inline-filter">
          <label for="dash-org">Organization</label>
          <select
            id="dash-org"
            class="field"
            [value]="d().organizationId"
            (change)="select(+$any($event.target).value)"
          >
            @for (o of orgList; track o.id) {
              <option [value]="o.id">{{ o.name }}</option>
            }
          </select>
        </div>
      }
      @let p = d().pipeline.value;
      @let af = d().approvedFunded.value;
      @let busy = (d().organizations.loading || d().pipeline.loading) && !p;
      <div class="kpi-row section">
        <gz-kpi
          label="Applications"
          icon="brief"
          link="/loan-review"
          [loading]="busy"
          [value]="p ? p.total : null"
          [caption]="p ? openCount() + ' in review or draft' : ''"
          [unavailable]="noOrg() ? 'Set up your organization' : 'Not available yet'"
        />
        <gz-kpi
          label="Open volume"
          icon="wallet"
          tone="ink"
          link="/loan-review"
          [loading]="busy"
          [value]="p ? money(openAmount()) : null"
          caption="Requested, not yet decided"
          [unavailable]="noOrg() ? 'Set up your organization' : 'Not available yet'"
        />
        <gz-kpi
          label="Approved"
          icon="check"
          tone="green"
          link="/loan-review"
          [loading]="d().approvedFunded.loading && !af"
          [value]="af ? money(af.approved.totalAmount) : null"
          [caption]="af ? af.approved.count + ' applications · ' + periodLabel() : ''"
          [unavailable]="noOrg() ? 'Set up your organization' : 'Not available yet'"
        />
        <gz-kpi
          label="Funded"
          icon="chart"
          tone="amber"
          link="/loan-review"
          [loading]="d().approvedFunded.loading && !af"
          [value]="af ? money(af.funded.totalAmount) : null"
          [caption]="af ? af.funded.count + ' loans · ' + periodLabel() : ''"
          [unavailable]="noOrg() ? 'Set up your organization' : 'Not available yet'"
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
          <section class="panel dash-card" aria-labelledby="card-lender-pipeline">
            <div class="panelhead">
              <div>
                <h3 id="card-lender-pipeline">Application pipeline</h3>
                <p class="smalltext muted">Count and requested amount by stage</p>
              </div>
              <a class="smalltext" routerLink="/loan-review">Loan review</a>
            </div>
            @if (noOrg()) {
              <div class="empty-state">
                <gz-icon name="brief" />
                <p>Create your lending organization to track applications and collateral.</p>
                <a class="btn primary small" routerLink="/loan-review">Set up organization</a>
              </div>
            } @else if (busy) {
              @for (i of [1, 2, 3, 4, 5]; track i) {
                <div class="row-skeleton"></div>
              }
            } @else if (p && p.total) {
              <gz-stage-bars
                [rows]="stageRows()"
                link="/loan-review"
                label="Applications by stage"
              />
              <p class="sourcedata">
                {{ p.scope }} · {{ p.currency }} · as of {{ p.asOf | date: 'MMM d, h:mm a' }}
              </p>
            } @else if (p) {
              <div class="empty-state">
                <gz-icon name="brief" />
                <p>No applications yet. Add one or import a CSV in Loan review.</p>
                <a class="btn small" routerLink="/loan-review">Add an application</a>
              </div>
            }
          </section>
          @if (!noOrg() && d().organizationId !== null) {
            <section class="panel dash-card" aria-labelledby="card-funded">
              <div class="panelhead">
                <div>
                  <h3 id="card-funded">Approved, funded and loan mix</h3>
                  <p class="smalltext muted">{{ periodLabel() }} · UTC days</p>
                </div>
              </div>
              <form class="filterbar" #pf="ngForm" (ngSubmit)="pf.valid && applyPeriod()">
                <div class="formfield">
                  <label for="lender-from">From</label>
                  <input
                    id="lender-from"
                    name="fromDate"
                    type="date"
                    min="1900-01-01"
                    max="9999-12-31"
                    [(ngModel)]="fromDate"
                    [required]="!!toDate"
                  />
                </div>
                <div class="formfield">
                  <label for="lender-to">To</label>
                  <input
                    id="lender-to"
                    name="toDate"
                    type="date"
                    min="1900-01-01"
                    max="9999-12-31"
                    [(ngModel)]="toDate"
                    [required]="!!fromDate"
                  />
                </div>
                <button class="btn" [disabled]="pf.invalid || periodInvalid()">Apply</button>
                @if (d().period.fromDate) {
                  <button type="button" class="linkbtn" (click)="resetPeriod()">This month</button>
                }
              </form>
              @if (periodInvalid()) {
                <p class="field-error">The first day must not be after the last day.</p>
              }
              @if (d().approvedFunded.loading && !af) {
                @for (i of [1, 2, 3]; track i) {
                  <div class="row-skeleton"></div>
                }
              } @else if (af) {
                <div class="flow">
                  <div>
                    <span class="smalltext muted">Approved</span>
                    <b>{{ money(af.approved.totalAmount) ?? '—' }}</b>
                    <span class="smalltext muted">{{ af.approved.count }} applications</span>
                  </div>
                  <div>
                    <span class="smalltext muted">Funded</span>
                    <b class="green">{{ money(af.funded.totalAmount) ?? '—' }}</b>
                    <span class="smalltext muted">{{ af.funded.count }} loans</span>
                  </div>
                  <div>
                    <span class="smalltext muted">Period</span>
                    <b
                      >{{ af.period.fromDate | date: 'MMM d' }} –
                      {{ af.period.toDate | date: 'MMM d' }}</b
                    >
                    <span class="smalltext muted"
                      >{{ af.period.timeZone }} · {{ af.currency }}</span
                    >
                  </div>
                </div>
                @if (af.status === 'EMPTY') {
                  <p class="sub">No application was approved or funded in this period.</p>
                } @else if (af.funded.count) {
                  <h4 class="dash-subhead">Funded by loan type</h4>
                  <ul class="mix" aria-label="Funded loans by loan type">
                    @for (m of af.fundedLoanMix; track m.loanType) {
                      <li>
                        <span>{{ loanType(m.loanType) }}</span>
                        <span class="mix-track"
                          ><span class="mix-fill ink" [style.width.%]="mixShare(m.count)"></span
                        ></span>
                        <b>{{ m.count }} · {{ money(m.totalAmount) }}</b>
                      </li>
                    }
                  </ul>
                }
                @if (af.note) {
                  <p class="sourcedata">{{ af.note }}</p>
                }
              }
            </section>
          }
          @if (d().recent.value; as recent) {
            @if (recent.content.length) {
              <section class="panel dash-card" aria-labelledby="card-collateral">
                <div class="panelhead">
                  <div>
                    <h3 id="card-collateral">Recent applications &amp; collateral</h3>
                    <p class="smalltext muted">
                      Loan-to-value from the stored ZentraValue of each linked property
                    </p>
                  </div>
                </div>
                <div class="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Applicant</th>
                        <th scope="col">Loan</th>
                        <th scope="col">Stage</th>
                        <th scope="col">Collateral</th>
                        <th scope="col">LTV</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (a of recent.content; track a.id) {
                        <tr>
                          <td>
                            {{ a.applicantName }}
                            <div class="smalltext muted">{{ a.updatedAt | date: 'MMM d' }}</div>
                          </td>
                          <td>
                            {{ a.requestedAmount | currency: a.currency : 'symbol' : '1.0-0' }}
                            <div class="smalltext muted">{{ loanType(a.loanType) }}</div>
                          </td>
                          <td>
                            <span
                              class="tag"
                              [class.green]="a.stage === 'APPROVED' || a.stage === 'FUNDED'"
                              [class.amber]="a.stage === 'UNDER_REVIEW'"
                              >{{ stageLabel(a.stage) }}</span
                            >
                          </td>
                          @if (a.propertyId === null) {
                            <td colspan="2">
                              <span class="smalltext muted">No property linked</span>
                            </td>
                          } @else {
                            @let c = d().collateral[a.id];
                            <td>
                              <a [routerLink]="['/property', a.propertyId]">{{
                                c?.value?.collateral?.value
                                  ? money(c!.value!.collateral!.value)
                                  : 'View valuation'
                              }}</a>
                            </td>
                            <td>
                              @if (c?.loading) {
                                <span class="smalltext muted">Checking…</span>
                              } @else if (c?.error) {
                                <span class="smalltext muted" [title]="c!.error!">Unavailable</span>
                              } @else if (c?.value; as v) {
                                @if (v.ltv.percent !== null) {
                                  <b>{{ v.ltv.percent | number: '1.0-1' }}%</b>
                                  @if (v.ltv.status === 'LIMITED') {
                                    <span class="tag amber" [title]="limitedWhy(v)">Limited</span>
                                  }
                                  <div class="smalltext muted">of {{ basis(v) }}</div>
                                } @else {
                                  <span class="smalltext muted">{{ ltvWhy(v) }}</span>
                                }
                              }
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <p class="sourcedata">Informational only; not a credit decision or approval.</p>
              </section>
            }
          }
        </div>
        <div class="dash-side">
          <gz-mortgage-context-card />
          <gz-recent-activity />
        </div>
      </div>
    }
    <gz-dashboard-overview [compact]="false" />`,
})
export class LenderDashboard {
  w = inject(Workspace);
  d = this.w.store.selectSignal(selectLenderDashboard);
  signedIn = computed(() => this.w.auth.isLoggedIn() && !!this.w.account().profile);
  noOrg = computed(() => this.d().organizations.value?.length === 0);
  stageLabel = (s: LenderApplicationStage) => lenderStageLabels[s] ?? s;
  loanType = (t: string | null | undefined) =>
    loanTypeLabels[(t ?? 'UNKNOWN') as keyof typeof loanTypeLabels] ?? t;
  fromDate = '';
  toDate = '';
  cardError = computed(() => {
    const s = this.d();
    return s.organizations.error ?? s.pipeline.error ?? s.recent.error ?? s.approvedFunded.error;
  });
  periodLabel = computed(() => {
    const p = this.d().approvedFunded.value?.period;
    if (!this.d().period.fromDate) return 'This month';
    return p ? `${p.fromDate} to ${p.toDate}` : 'Chosen period';
  });
  openCount = computed(() => {
    const st = this.d().pipeline.value?.stages ?? {};
    return OPEN_STAGES.reduce((n, k) => n + (st[k]?.count ?? 0), 0);
  });
  openAmount = computed(() => {
    const st = this.d().pipeline.value?.stages ?? {};
    return OPEN_STAGES.reduce((n, k) => n + (st[k]?.requestedAmount ?? 0), 0);
  });
  stageRows = computed<StageRow[]>(() => {
    const st = this.d().pipeline.value?.stages ?? {};
    return LENDER_STAGES.map((k) => ({
      key: k,
      label: lenderStageLabels[k],
      count: st[k]?.count ?? 0,
      amount: st[k]?.requestedAmount ?? 0,
      muted: TERMINAL_LENDER_STAGES.includes(k) && k !== 'FUNDED',
    }));
  });
  private mixMax = computed(() =>
    Math.max(1, ...(this.d().approvedFunded.value?.fundedLoanMix.map((m) => m.count) ?? [])),
  );
  constructor() {
    effect(() => {
      if (this.signedIn()) untracked(() => this.load());
    });
  }
  load() {
    this.w.store.dispatch(A.load());
  }
  select(organizationId: number) {
    this.w.store.dispatch(A.selectOrganization({ organizationId }));
  }
  periodInvalid() {
    return !!this.fromDate && !!this.toDate && this.fromDate > this.toDate;
  }
  /** Both days or neither: the API refuses a period with one end only. */
  applyPeriod() {
    if (this.periodInvalid() || !this.fromDate !== !this.toDate) return;
    this.w.store.dispatch(
      A.setPeriod({ period: { fromDate: this.fromDate || null, toDate: this.toDate || null } }),
    );
  }
  resetPeriod() {
    this.fromDate = '';
    this.toDate = '';
    this.w.store.dispatch(A.setPeriod({ period: { fromDate: null, toDate: null } }));
  }
  money(v: number | null | undefined) {
    return usdCompact(v);
  }
  mixShare(count: number) {
    return count ? Math.max(3, (count / this.mixMax()) * 100) : 0;
  }
  basis(v: LenderCollateralAnalysisDTO) {
    const what = { FUNDED: 'funded', APPROVED: 'approved', REQUESTED: 'requested' }[
      v.loanAmountBasis
    ];
    return `${usdCompact(v.loanAmount) ?? 'the loan'} ${what ?? ''}`.trim();
  }
  ltvWhy(v: LenderCollateralAnalysisDTO) {
    return v.ltv.reasons.map((r) => LTV_REASONS[r] ?? r).join(' ') || 'Not available';
  }
  limitedWhy(v: LenderCollateralAnalysisDTO) {
    return (
      v.collateral?.reasons?.map((r) => r.message).join(' ') || 'Computed from a limited valuation.'
    );
  }
}
